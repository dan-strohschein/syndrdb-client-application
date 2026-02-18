# JSON Tree View

Displays JSON (string or object) in an interactive, expand/collapse tree. Intended for the query results view.

## Usage

Import the component (registers `<json-tree-view>`):

```ts
import './components/json-tree-view/json-tree-view';
```

Use in a template:

```html
<!-- From a parsed object (e.g. query result) -->
<json-tree-view .data=${queryResult.data} default-expanded-depth="2"></json-tree-view>

<!-- From a JSON string -->
<json-tree-view .data=${jsonString}></json-tree-view>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `string \| object` | — | JSON as string (parsed with `JSON.parse`) or already-parsed object/array. Invalid string shows an error message. |
| `defaultExpandedDepth` | `number` | `1` | Levels expanded by default (0 = all collapsed, 1+ = expand that many levels). |

## Demo data example

```ts
const sample = {
  users: [{ name: 'a', count: 1 }, { name: 'b', count: 2 }],
  meta: { total: 2 }
};
```

```html
<json-tree-view .data=${sample} default-expanded-depth="2"></json-tree-view>
```
