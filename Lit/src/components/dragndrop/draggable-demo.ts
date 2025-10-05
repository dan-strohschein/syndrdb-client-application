import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './draggable';
import './droppable';

@customElement('draggable-demo')
export class DraggableDemo extends LitElement {
    @state()
    private dropLog: string[] = [];

    @state()
    private textAreaContent = '-- Write your SyndrQL query here\nUSE "TestDB";\nSELECT DOCUMENTS FROM "TestBundle" LIMIT 10;';

    // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }

    private handleDrop = (event: CustomEvent) => {
        const { result, dropData, draggable } = event.detail;
        const timestamp = new Date().toLocaleTimeString();
        
        console.log('🎯 Demo received drop event:', event.detail);
        
        // Add to log
        this.dropLog = [
            `${timestamp}: Dropped "${dropData}" into dropzone`,
            ...this.dropLog.slice(0, 4) // Keep only last 5 entries
        ];
    }

    private handleTextAreaDrop = (event: CustomEvent) => {
        const { dropData } = event.detail;
        console.log('🎯 Demo textarea drop:', dropData);
        
        // Insert the drop data into the textarea at the end
        this.textAreaContent += `\n-- Dropped: ${dropData}`;
        
        // Update the actual textarea element
        const textarea = this.querySelector('#demo-textarea') as HTMLTextAreaElement;
        if (textarea) {
            textarea.value = this.textAreaContent;
        }
    }

    render() {
        return html`
            <div class="p-8 space-y-6">
                <h2 class="text-xl font-bold mb-4">Drag & Drop Demo</h2>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Left Column: Draggable Items -->
                    <div class="space-y-4">
                        <h3 class="text-lg font-semibold text-gray-800">Draggable Items</h3>
                        <p class="text-sm text-gray-600">Click and hold to drag these items to the drop zones →</p>
                        
                        <!-- SQL Query draggable -->
                        <draggable-component .getDropDataHandler=${() => 'SELECT * FROM users WHERE active = true;'}>
                            <div class="bg-blue-100 border border-blue-300 p-4 rounded-lg cursor-move">
                                <h4 class="font-semibold text-blue-800">SQL Query</h4>
                                <p class="text-blue-600 text-sm">Drag to insert: SELECT * FROM users...</p>
                            </div>
                        </draggable-component>

                        <!-- Database name draggable -->
                        <draggable-component .getDropDataHandler=${() => 'USE "ProductionDB";'}>
                            <div class="bg-green-100 border border-green-300 p-4 rounded-lg cursor-move">
                                <h4 class="font-semibold text-green-800">Database Switch</h4>
                                <p class="text-green-600 text-sm">Drag to insert: USE "ProductionDB";</p>
                            </div>
                        </draggable-component>

                        <!-- Table name draggable -->
                        <draggable-component .getDropDataHandler=${() => 'FROM "Orders"'}>
                            <div class="bg-purple-100 border border-purple-300 p-4 rounded-lg cursor-move">
                                <h4 class="font-semibold text-purple-800">Table Reference</h4>
                                <p class="text-purple-600 text-sm">Drag to insert: FROM "Orders"</p>
                            </div>
                        </draggable-component>

                        <!-- Complex query draggable -->
                        <draggable-component .getDropDataHandler=${() => 'SELECT DOCUMENTS FROM "Users" WHERE age > 21 ORDER BY name LIMIT 100;'}>
                            <div class="bg-orange-100 border border-orange-300 p-4 rounded-lg cursor-move">
                                <h4 class="font-semibold text-orange-800">Complex Query</h4>
                                <p class="text-orange-600 text-sm">Drag to insert: Full SyndrQL query</p>
                            </div>
                        </draggable-component>
                    </div>

                    <!-- Right Column: Drop Zones -->
                    <div class="space-y-4">
                        <h3 class="text-lg font-semibold text-gray-800">Drop Zones</h3>
                        <p class="text-sm text-gray-600">Drop draggable items here to see the magic! ✨</p>
                        
                        <!-- Query Editor Drop Zone -->
                        <droppable-component @drop-completed=${this.handleTextAreaDrop}>
                            <div class="bg-gray-50 border border-gray-300 rounded-lg p-4">
                                <h4 class="font-semibold text-gray-800 mb-2">Query Editor (Demo)</h4>
                                <textarea 
                                    id="demo-textarea"
                                    class="w-full h-32 p-3 border border-gray-300 rounded font-mono text-sm"
                                    placeholder="Drop query components here..."
                                    .value=${this.textAreaContent}
                                    @input=${(e: Event) => {
                                        this.textAreaContent = (e.target as HTMLTextAreaElement).value;
                                    }}
                                ></textarea>
                                <p class="text-xs text-gray-500 mt-1">This demonstrates how the query editor would work</p>
                            </div>
                        </droppable-component>

                        <!-- General Drop Zone -->
                        <droppable-component @drop-completed=${this.handleDrop}>
                            <div class="bg-yellow-50 border border-yellow-300 rounded-lg p-6 min-h-[120px] flex items-center justify-center">
                                <div class="text-center">
                                    <div class="text-2xl mb-2">📥</div>
                                    <p class="text-yellow-800 font-medium">General Drop Zone</p>
                                    <p class="text-yellow-600 text-sm">Drop items here to see them logged below</p>
                                </div>
                            </div>
                        </droppable-component>

                        <!-- Drop Log -->
                        <div class="bg-gray-100 border border-gray-300 rounded-lg p-4">
                            <h4 class="font-semibold text-gray-800 mb-2">Drop Log</h4>
                            <div class="space-y-1 max-h-32 overflow-y-auto">
                                ${this.dropLog.length > 0 ? 
                                    this.dropLog.map(entry => html`
                                        <div class="text-sm text-gray-600 font-mono">${entry}</div>
                                    `) :
                                    html`<div class="text-sm text-gray-500 italic">No drops yet...</div>`
                                }
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Instructions -->
                <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 class="font-semibold text-blue-800 mb-2">How to Use:</h4>
                    <ul class="text-blue-700 text-sm space-y-1">
                        <li>• Click and hold any draggable item on the left</li>
                        <li>• Drag it over to a drop zone on the right</li>
                        <li>• Notice the green border that appears when hovering over drop zones</li>
                        <li>• Release the mouse to drop and see the data transfer</li>
                        <li>• The query editor demo shows how text can be inserted at drop</li>
                    </ul>
                </div>

                <!-- Technical Details -->
                <div class="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 class="font-semibold text-gray-800 mb-2">Technical Details:</h4>
                    <ul class="text-gray-600 text-sm space-y-1">
                        <li>• Each draggable has a <code class="bg-gray-200 px-1 rounded">getDropDataHandler</code> that returns specific data</li>
                        <li>• Drop zones get a green dashed border on hover during drag operations</li>
                        <li>• The <code class="bg-gray-200 px-1 rounded">drop-completed</code> event contains the transferred data</li>
                        <li>• This demonstrates the foundation for query editor drag & drop</li>
                    </ul>
                </div>
            </div>
        `;
    }
}