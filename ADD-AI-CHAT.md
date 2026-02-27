# AI Query Assistant — Implementation Plan

## Context

Users want to write SyndrQL using natural language. The assistant converts English prompts into valid SyndrQL statements and inserts them into the code editor. The model is **server-hosted** (you host it), **small** (3B-7B parameters, fine-tuned), and the feature is **premium-gated** in a freemium model. No frontier model API costs for users.

The codebase already has ~70% of the infrastructure needed:
- **Command builders** in `Lit/src/domain/bundle-commands.ts` — convert typed objects → SyndrQL text
- **Schema context** in `document-context.ts` — `toCache()` serializes databases/bundles/fields to JSON
- **Grammar files** (DDL, DML, DOL, Migration) — complete SyndrQL syntax specification
- **Code editor API** — `getText()` public; `insertText(position, text)` and `getEndPosition()` to be added for append-at-end
- **Validation pipeline** — LanguageServiceV2 validates any SyndrQL for syntax/semantic errors
- **IPC pattern** — `preload.ts` exposes contextBridge APIs, main process handles network

## Architecture

```
User Prompt + Schema Context (from DocumentContext.toCache())
    ↓
AIAssistantService (renderer singleton)
    ↓ IPC
AIAssistantMainService (main process — HTTP to model server)
    ↓ HTTPS
Model Server (fine-tuned 3B-7B, grammar-constrained JSON output)
    ↓
Structured IR JSON (matches AI IR Schema types)
    ↓
SyndrQL Compiler (pure functions, extends bundle-commands.ts pattern)
    ↓
Validate via LanguageServiceV2 (context loaded from same schema payload)
    ↓
Preview to user → Insert at end of document via insertText(endPosition, text)
```

---

## Phase 1: IR Schema + Compiler (client-side, no server needed)

### 1a. Define AI IR Schema
**New file: `Lit/src/domain/ai-ir-schema.ts`**

A discriminated union of all SyndrQL statement types. Each type maps closely to existing domain models and grammar rules. The model's job is to produce one of these JSON objects.

Key types:
- **DDL**: `CreateBundleIR`, `UpdateBundleIR`, `DropBundleIR`, `CreateDatabaseIR`, `DropDatabaseIR`
- **DML**: `SelectIR`, `AddDocumentIR`, `UpdateDocumentsIR`, `DeleteDocumentIR`
- **DOL**: `UseDatabaseIR`, `ShowBundlesIR`, `ShowDatabasesIR`, `CreateUserIR`, `GrantPermissionsIR`, etc.
- **Migration**: `StartMigrationIR`, `ApplyMigrationIR`, `RollbackMigrationIR`
- **Shared**: `IRFieldDefinition`, `IRWhereClause`, `IRCondition`, `IRJoinClause`, `IROrderByClause`
- **Wrapper**: `AIAssistantResponse { statements: SyndrQLIR[]; explanation?: string; confidence?: number }`

Design rationale: `statementType` discriminant enables exhaustive switch compilation. Values are plain strings — the compiler handles SyndrQL quoting rules, not the model.

### 1b. Build SyndrQL Compiler (TypeScript — client-side)
**New file: `Lit/src/domain/syndrql-compiler.ts`**

Pure function module (same pattern as `bundle-commands.ts`):
- `compileIR(ir: SyndrQLIR): string` — switch on `statementType`, delegates to type-specific functions
- `compileAIResponse(response: AIAssistantResponse): string` — compiles multiple statements
- Reuses `fieldToCreateFragment` pattern from `bundle-commands.ts` for field definitions
- Shared helpers: `compileWhere()`, `compileCondition()`, `compileOrderBy()`
- All output is semicolon-terminated with proper identifier quoting

This version runs in the Electron client to compile IR received from the model server into SyndrQL for the editor.

### 1c. Build SyndrQL Compiler (Go — server-side)
**New file in model server repo (e.g., `syndrql-ai-server/compiler/compiler.go`)**

Port of the TypeScript compiler to Go. Same IR schema, same compilation logic, same output format. This version runs on the server side for:
- **Pre-validation**: Compile IR → SyndrQL on the server to verify the model's output is valid before sending it to the client
- **Server-side integration**: Can be imported into SyndrDB itself if you later want the database to accept IR directly
- **Training data validation**: Use during training data generation to verify every IR example compiles to valid SyndrQL

The Go compiler should:
- Define the same IR types as structs with JSON tags matching the TypeScript schema
- Implement `CompileIR(ir SyndrQLIR) (string, error)` with the same switch-on-statementType pattern
- Include a `ValidateIR(ir SyndrQLIR) error` function that checks structural validity without compiling
- Be a standalone Go package with no dependencies on the SyndrDB server codebase (can be imported later)

Both compilers must produce **identical output** for the same IR input. The TypeScript test suite should include golden-file tests (IR JSON → expected SyndrQL string) that are shared with the Go test suite to ensure parity.

### 1d. Unit Tests
**TypeScript: `tests/unit/syndrql-compiler.test.ts`**
**Go: `syndrql-ai-server/compiler/compiler_test.go`**

Every statement type gets test coverage in both languages. Use a shared set of golden test fixtures (JSON files with IR input + expected SyndrQL output) to guarantee both compilers produce identical results. Pure functions = easy to test in both languages.

---

## Phase 2: IPC + Service Layer

### 2a. IPC Bridge
**Modify: `Lit/src/types/electron-api.ts`** — add `AIAssistantElectronAPI` interface
**Modify: `Lit/src/electron/preload.ts`** — add `aiAssistant` namespace to contextBridge:
- `generateQuery(request)` → `ipcRenderer.invoke('ai-assistant:generate-query', request)`
- `checkSubscription()` → `ipcRenderer.invoke('ai-assistant:check-subscription')`

### 2b. Main Process Service
**New file: `Lit/src/electron/ai-assistant-main-service.ts`**

Handles HTTP calls to the model server from the main process (API keys stay out of renderer):
- Uses Node.js `fetch` (Electron 27 supports it natively)
- Loads API endpoint from config, API key from secure storage (see below)
- Request payload (exact contract): `{ prompt, schemaContext, currentDatabase }` where `schemaContext` is exactly `DocumentContext.toCache()` (no transformation). Same shape as in document-context.ts `toCache()`: `{ databases, permissions, migrations, lastRefreshTime }`.
- Receives: `AIAssistantResponse` JSON (structured IR)
- Timeout + error handling

**Secure storage (OS-agnostic):** Use Electron `safeStorage` (main process). It uses the OS keychain: macOS Keychain, Windows Credential Vault, Linux libsecret. Encrypt the API key before storing and decrypt when reading; use a well-known key name (e.g. `syndrdb.ai-assistant.api-key`). For development, allow override via environment variable so no keychain write is required. New file: `Lit/src/electron/secure-storage.ts` (or similar) wrapping `safeStorage.encryptString` / `safeStorage.decryptString` with try/catch for when keychain is unavailable (e.g. Linux without secret service); in that case fall back to a local encrypted file in app user data, or prompt user to set env var.

**Modify: `Lit/main.ts`** — register `ipcMain.handle('ai-assistant:generate-query', ...)` and `ipcMain.handle('ai-assistant:check-subscription', ...)`

### 2c. Renderer Service
**New file: `Lit/src/services/ai-assistant-service.ts`**

Singleton (same pattern as `ConnectionManager`). Orchestrates the full pipeline:
1. Serialize schema context via `DocumentContext.toCache()` (already exists, line 255-283 of document-context.ts)
2. Call IPC to main process with request `{ prompt, schemaContext, currentDatabase }` (schemaContext = that serialized value)
3. Compile IR → SyndrQL via `compileAIResponse()`
4. Validate via a **dedicated** `LanguageServiceV2` whose `DocumentContext` is loaded from the **same** schema payload sent to the model: instantiate the service, then `context.loadFromCache(schemaContext)` so validation is schema-aware and consistent with what the model saw
5. Return result with generated text, explanation, validation status

### 2d. Config
**Modify: `config.yaml`** — add `aiAssistant` section (enabled, endpoint, requestTimeout, maxResponseTokens, **premiumEnabled** default true for stub)
**Modify: `Lit/src/config/config-types.ts`** — add `AIAssistantConfig` interface (include `premiumEnabled?: boolean`)

---

## Phase 3: UI Components (ship first with premium stub)

### 3a. AI Assistant Panel
**New file: `Lit/src/components/ai-assistant/ai-assistant-panel.ts`**

Collapsible panel within the query editor frame (not a modal — keeps editor visible):
- Text input + submit button for natural language prompt
- Generated SyndrQL preview (read-only code block)
- Model explanation text
- Validation status (green check or error list)
- Action buttons: [Insert into Editor], [Copy], [Retry]
- Loading spinner during generation
- No Shadow DOM, Tailwind/DaisyUI styling

### 3b. Editor Integration
**Modify: `Lit/src/components/query-editor/query-editor-frame.ts`**

- Add `<ai-assistant-panel>` to the template
- Listen for `ai-query-insert-requested` CustomEvent
- Handler gets end-of-document position from the code editor and calls `codeEditor.insertText(endPosition, generatedSyndrQL)`. **Insert behavior: always append to the end of the document** (no cursor-insert option).

**Modify: `Lit/src/components/code-editor/code-editor.ts`** — add public API for append-at-end: `getEndPosition(): Position` (or equivalent so caller can compute end of document) and `insertText(position: Position, text: string): void`. Ensure the frame can resolve the active `code-editor` and call these (same pattern as existing `getText()` in executeQuery).

### 3c. Premium Gate (stub first; real licensing later)
- **Ship UI first:** Use a **config option** (e.g. `aiAssistant.premiumEnabled` in `config.yaml`) that defaults to **true** (turned on). When true, show the AI panel with no license check. When false, show upsell banner. No `LicenseService` dependency yet.
- **Later:** When `LicenseService` is implemented, gate can check `LicenseService.getInstance().premium` and optionally respect the config override for development (e.g. `premiumEnabled: true` bypasses license check).

### 3d. Toggle Button
**Modify: `Lit/src/components/navigation-bar.ts`** — add AI assistant toggle button in toolbar

---

## Phase 4: Server-Side (detailed step-by-step)

This is a separate workstream from the client-side code. Covers model selection, training data generation, fine-tuning on your local RTX 3090, serving infrastructure, and deployment.

---

## Phase 5: License Service (implement later)

**New file (when implemented): `Lit/src/services/license-service.ts`** — singleton, checks subscription status via IPC → main process → license server. Stores status locally with TTL for offline grace period. Until then, the premium gate uses the `aiAssistant.premiumEnabled` config stub (Phase 3c).

---

### Step 1: Model Selection

**Recommended: Qwen2.5-3B-Instruct**

| Model | Size | Structured Output | Code Understanding | License |
|---|---|---|---|---|
| **Qwen2.5-3B-Instruct** | 3B | Excellent | Excellent | Apache 2.0 |
| Qwen2.5-Coder-3B-Instruct | 3B | Excellent | Best for code | Apache 2.0 |
| Phi-3.5-mini-instruct | 3.8B | Very good | Good | MIT |
| Llama-3.2-3B-Instruct | 3B | Good | Good | Llama 3.2 |
| Qwen2.5-7B-Instruct | 7B | Excellent | Excellent | Apache 2.0 |

Start with **Qwen2.5-3B-Instruct**. If quality is insufficient after fine-tuning, step up to the 7B variant. Avoid MoE models — they use more VRAM than their "active parameter" count suggests.

---

### Step 2: Training Data Generation

Target **500-1,000 high-quality examples** for v1.

#### 2a. Training data format (JSONL)

```json
{
  "natural_language": "Create a bundle called users with a required string field called email and an optional integer field called age",
  "schema_context": {"databases": {"mydb": {"bundles": {}}}},
  "json_output": "{\"statements\": [{\"statementType\": \"CREATE_BUNDLE\", \"bundleName\": \"users\", \"fields\": [{\"name\": \"email\", \"type\": \"STRING\", \"isRequired\": true, \"isUnique\": false}, {\"name\": \"age\", \"type\": \"INT\", \"isRequired\": false, \"isUnique\": false}]}]}"
}
```

#### 2b. Generate pairs programmatically

1. **Enumerate SyndrQL patterns from grammar files** — Walk DDL, DML, DOL, Migration grammar JSONs. Generate concrete SyndrQL by substituting identifiers, types, and values.
2. **Create corresponding IR JSON** — deterministic mapping since you define both grammar and IR schema.
3. **Generate NL descriptions via a frontier model (one-time cost ~$50-100)** — Feed each IR JSON + SyndrQL pair to Claude/GPT-4: "Write 3-5 different natural language ways a user might request this."

#### 2c. Coverage targets

| Statement Type | Variations | x NL phrasings | Total |
|---|---|---|---|
| CREATE BUNDLE | ~30 field combos | x5 | 150 |
| SELECT/FIND | ~80 clause combos | x5 | 400 |
| INSERT/ADD DOCUMENT | ~20 field combos | x5 | 100 |
| UPDATE DOCUMENTS | ~20 clause combos | x5 | 100 |
| DELETE DOCUMENT | ~15 clause combos | x5 | 75 |
| ALTER/UPDATE BUNDLE | ~20 variants | x5 | 100 |
| DROP/DELETE BUNDLE/DATABASE | ~10 variants | x5 | 50 |
| DOL (users, permissions) | ~15 variants | x3 | 45 |
| USE DATABASE, SHOW | ~10 variants | x3 | 30 |
| **Total** | | | **~1,050** |

#### 2d. Quality checklist

- Every IR JSON must compile to valid SyndrQL via the compiler (automated check)
- Varied NL vocabulary ("create", "make", "set up", "add a new")
- Include examples with and without schema context
- Include multi-statement requests

---

### Step 3: Fine-Tuning with QLoRA on Your RTX 3090

#### 3a. Local environment setup

Your hardware: i9 + 64GB DDR5 + RTX 3090 (24GB VRAM). Needs ~6-8GB VRAM for QLoRA on 3B model — plenty of headroom.

```bash
# 1. Verify NVIDIA driver and CUDA
nvidia-smi
# Should show driver >= 525.x, CUDA >= 12.0

# 2. Create project
mkdir ~/syndrql-training && cd ~/syndrql-training
python3 -m venv venv && source venv/bin/activate

# 3. Install PyTorch with CUDA
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# 4. Verify GPU access
python3 -c "import torch; print(f'GPU: {torch.cuda.get_device_name(0)}, VRAM: {torch.cuda.get_device_properties(0).total_mem / 1024**3:.1f} GB')"

# 5. Install Unsloth (2x faster training, 60% less VRAM)
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
pip install --no-deps trl peft accelerate bitsandbytes
pip install datasets

# 6. Verify
python3 -c "from unsloth import FastLanguageModel; print('Unsloth ready')"
```

**Troubleshooting:**
- `bitsandbytes` errors → check `nvcc --version` matches driver
- Unsloth fails → fallback: `pip install peft trl accelerate bitsandbytes datasets transformers`

#### 3b. Training script

```python
# train_syndrql.py
from unsloth import FastLanguageModel
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset
import torch

# Load base model in 4-bit
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="Qwen/Qwen2.5-3B-Instruct",
    max_seq_length=2048, dtype=None, load_in_4bit=True,
)

# Add LoRA adapters
model = FastLanguageModel.get_peft_model(
    model, r=16,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                     "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16, lora_dropout=0, bias="none",
    use_gradient_checkpointing="unsloth",
)

# Load and format data
dataset = load_dataset("json", data_files="training_data.jsonl", split="train")

def format_chat(example):
    system_msg = ("You are a SyndrQL query generator. Convert natural language to a "
                  "structured JSON object matching the AIAssistantResponse schema.")
    user_msg = example["natural_language"]
    if example.get("schema_context"):
        user_msg += f"\n\nSchema context: {example['schema_context']}"
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
        {"role": "assistant", "content": example["json_output"]}
    ]
    return {"text": tokenizer.apply_chat_template(messages, tokenize=False)}

dataset = dataset.map(format_chat)

# Train
trainer = SFTTrainer(
    model=model, tokenizer=tokenizer, train_dataset=dataset,
    args=SFTConfig(
        per_device_train_batch_size=4, gradient_accumulation_steps=4,
        warmup_steps=10, num_train_epochs=3, learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=10, output_dir="./syndrql-adapter",
        optim="adamw_8bit", seed=42, max_seq_length=2048,
        dataset_text_field="text",
    ),
)
stats = trainer.train()
print(f"Training completed in {stats.metrics['train_runtime']:.0f}s")

# Save adapter (~200MB)
model.save_pretrained("./syndrql-adapter")
tokenizer.save_pretrained("./syndrql-adapter")

# Merge into full model for deployment (~7GB)
model.save_pretrained_merged("./syndrql-merged", tokenizer, save_method="merged_16bit")
```

#### 3c. Expected performance on your RTX 3090

| Phase | Time |
|---|---|
| Model download (first time) | 5-10 min |
| Training (1K examples, 3 epochs) | ~30-45 min with Unsloth |
| Merging adapter + base | ~3-5 min |
| **Total** | **~45-60 min, $0 cost** |

#### 3d. Evaluation

```python
# evaluate.py
import json
from vllm import LLM, SamplingParams

llm = LLM(model="./syndrql-merged", dtype="auto", max_model_len=1024, gpu_memory_utilization=0.75)
sampling = SamplingParams(temperature=0.1, max_tokens=512)

with open("test_data.jsonl") as f:
    tests = [json.loads(line) for line in f]

correct = 0
for test in tests:
    output = llm.generate([f"Convert to SyndrQL JSON: {test['natural_language']}"], sampling)[0].outputs[0].text
    try:
        if json.loads(output) == json.loads(test["json_output"]): correct += 1
    except: pass

print(f"Accuracy: {correct}/{len(tests)} = {correct/len(tests)*100:.1f}%")
```

Target: **>90% accuracy**. If below, increase training data or step up to 7B.

---

### Step 4: Serving with vLLM + Grammar-Constrained Decoding

#### 4a. Start vLLM (locally for dev, or on production server)

```bash
pip install vllm

vllm serve ./syndrql-merged \
  --host 0.0.0.0 --port 8001 \
  --served-model-name syndrql-model \
  --dtype auto --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --guided-decoding-backend outlines \
  --api-key "your-internal-api-key"
```

#### 4b. Grammar-constrained decoding

When a request includes `guided_json`, the Outlines backend:
1. Converts your JSON schema to a **finite-state machine (FSM)** at compile time
2. At each token step, creates a **logit mask** — invalid tokens get `-inf` logits
3. Model can only sample valid tokens
4. FSM compiled once per schema, then cached (1-5s first time, instant after)

**100% structural compliance guaranteed** — model cannot output invalid JSON.

#### 4c. Calling from Node.js (Electron main process)

```typescript
const response = await fetch('https://your-server.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-internal-api-key'
  },
  body: JSON.stringify({
    model: 'syndrql-model',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.1,
    max_tokens: 512,
    guided_json: AI_ASSISTANT_RESPONSE_SCHEMA
  })
});
const data = await response.json();
const irJson = JSON.parse(data.choices[0].message.content); // guaranteed valid
```

---

### Step 5: FastAPI Wrapper (auth, rate limiting)

```
syndrql-ai-server/
├── server.py              # FastAPI app
├── requirements.txt       # fastapi, uvicorn, httpx, slowapi, pydantic
├── Dockerfile
├── docker-compose.yml     # vLLM + FastAPI + nginx
└── schemas/
    └── ai_response.json   # JSON Schema from ai-ir-schema.ts
```

FastAPI sits in front of vLLM, adding:
- Bearer token auth per API key
- Rate limiting via `slowapi` (30 req/min default)
- Health check endpoint
- Request/response logging
- Schema context injection into system prompt

See the plan file for complete server.py implementation.

---

### Step 6: Docker Deployment

```yaml
# docker-compose.yml
services:
  vllm:
    image: vllm/vllm-openai:latest
    runtime: nvidia
    volumes: ["./models/syndrql-merged:/model"]
    command: >
      --model /model --served-model-name syndrql-model
      --host 0.0.0.0 --port 8001 --max-model-len 4096
      --gpu-memory-utilization 0.90 --guided-decoding-backend outlines
      --dtype auto --api-key ${VLLM_API_KEY}
    deploy:
      resources:
        reservations:
          devices: [{driver: nvidia, count: 1, capabilities: [gpu]}]
  api:
    build: .
    ports: ["8000:8000"]
    environment:
      - VLLM_URL=http://vllm:8001/v1
      - VLLM_API_KEY=${VLLM_API_KEY}
      - API_KEYS=${API_KEYS}
    depends_on: [vllm]
  nginx:
    image: nginx:alpine
    ports: ["443:443"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf", "./certs:/etc/nginx/certs"]
    depends_on: [api]
```

---

### Step 7: Hosting

**Recommendation for v1: RunPod always-on Community Cloud, RTX 3090 (~$180/month)**

| Option | Cost | Best For |
|---|---|---|
| RunPod Serverless (scale to zero) | $5-720/month | Low/variable traffic |
| RunPod Always-On RTX 3090 | ~$180/month | Steady traffic, no cold starts |
| RunPod Always-On A10G | ~$260/month | Higher throughput |
| Modal.com | Pay-per-second | Best DX, auto-scaling |

---

### Step 8: Iterative Improvement

1. **Log prompts and outcomes** (with user consent)
2. **Rejected/edited examples become training data**
3. **Retrain periodically** on your RTX 3090 (~30 min, $0)
4. **Monitor accuracy** — target >85% accept rate

---

### Server-Side Summary

| Step | What | Time | Cost |
|---|---|---|---|
| Training data | Generate 1K NL-to-IR pairs | 1-2 days | ~$50-100 (one-time) |
| Fine-tuning | QLoRA via Unsloth on your RTX 3090 | 45-60 min | $0 (local) |
| Evaluation | Test accuracy on held-out set | 1 hour | $0 |
| Server setup | Docker Compose + RunPod | 1 day | ~$180/month |
| API wrapper | FastAPI + auth + rate limiting | 1 day | included |
| **Total** | | **~1 week** | **~$100 one-time + ~$180/month** |

You can serve the model locally on your RTX 3090 for all development and testing — zero cost until you're ready to ship to users.

---

## Critical Files

| File | Action | Purpose |
|---|---|---|
| `Lit/src/domain/ai-ir-schema.ts` | Create | IR type definitions |
| `Lit/src/domain/syndrql-compiler.ts` | Create | IR → SyndrQL compilation (TypeScript, client-side) |
| `syndrql-ai-server/compiler/compiler.go` | Create | IR → SyndrQL compilation (Go, server-side) |
| `tests/unit/syndrql-compiler.test.ts` | Create | TypeScript compiler tests |
| `syndrql-ai-server/compiler/compiler_test.go` | Create | Go compiler tests |
| `tests/fixtures/compiler-golden/*.json` | Create | Shared golden test fixtures (IR → expected SyndrQL) |
| `Lit/src/services/ai-assistant-service.ts` | Create | Renderer-side singleton |
| `Lit/src/electron/ai-assistant-main-service.ts` | Create | Main process HTTP client |
| `Lit/src/components/ai-assistant/ai-assistant-panel.ts` | Create | UI component |
| `Lit/src/services/license-service.ts` | Create | Premium gating |
| `Lit/src/types/electron-api.ts` | Modify | Add AI IPC types |
| `Lit/src/electron/preload.ts` | Modify | Add AI IPC bridge |
| `Lit/main.ts` | Modify | Register AI IPC handlers |
| `Lit/src/components/query-editor/query-editor-frame.ts` | Modify | Add AI panel + insert handler (append at end) |
| `Lit/src/components/code-editor/code-editor.ts` | Modify | Add public insertText(position, text), getEndPosition() |
| `Lit/src/electron/secure-storage.ts` (or similar) | Create | OS-agnostic API key storage (Electron safeStorage + fallback) |
| `Lit/src/components/navigation-bar.ts` | Modify | Add AI toggle button |
| `config.yaml` | Modify | Add aiAssistant config section |
| `Lit/src/domain/bundle-commands.ts` | Reference | Reuse `fieldToCreateFragment` pattern |
| `Lit/src/components/code-editor/syndrQL-language-serviceV2/document-context.ts` | Reference | `toCache()` for schema context serialization |

## Verification

1. **Compiler tests**: `npm test` — all IR types compile to syntactically valid SyndrQL
2. **Manual test**: Start dev mode (`cd Lit && npm run electron:dev`), open AI panel, type a natural language prompt, verify SyndrQL appears in preview, click Insert, verify it lands in the code editor and passes validation
3. **Validation check**: Generated SyndrQL should show no red underlines from LanguageServiceV2 for well-formed prompts
4. **IPC test**: Verify main process receives requests and forwards to model server (initially mock the server response)
5. **Premium gate**: Verify non-premium users see upsell banner, premium users see the AI panel




That can give you non-zero accuracy when the model outputs the right JSON inside markdown, but the **real fix** is training and prompting so the model outputs **only** that JSON with no extra words.

---

## Summary

| Observation | Meaning |
|------------|--------|
| Lots of words, explanations, markdown | Model is not trained (or prompted) to “output only JSON”. |
| Multiple JSON blocks / repetition | Same issue; target should be a single JSON object. |
| 0% accuracy | `json.loads(full_output)` fails or parses wrong thing; or schema doesn’t match gold. |

So: **this result is not expected for your eval.** Fix it by: (1) training with targets that are only the gold JSON and the same schema, (2) using a strict “output only JSON” prompt at eval time, and (3) optionally adding `extract_json()` in the eval script so you can measure accuracy once the model puts the right JSON inside the verbose response.