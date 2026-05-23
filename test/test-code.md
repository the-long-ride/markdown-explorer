# 🧪 Test: Code Blocks & Syntax Highlighting

This document tests syntax highlighting across all supported programming languages.

---

## JavaScript (JS)

```javascript
// Calculate factorial recursively
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

const result = factorial(5);
console.log(`Factorial of 5 is: ${result}`);
```

---

## TypeScript (TS)

```typescript
interface User {
  id: number;
  name: string;
  role: 'admin' | 'user';
  email?: string;
}

class UserManager {
  private users: User[] = [];

  public addUser(user: User): void {
    this.users.push(user);
  }

  public getAdmins(): User[] {
    return this.users.filter(u => u.role === 'admin');
  }
}
```

---

## Python (py)

```python
import hashlib
from datetime import datetime

class Block:
    def __init__(self, index, data, previous_hash):
        self.index = index
        self.timestamp = datetime.now()
        self.data = data
        self.previous_hash = previous_hash
        self.hash = self.calculate_hash()

    def calculate_hash(self):
        sha = hashlib.sha256()
        sha.update(f"{self.index}{self.timestamp}{self.data}{self.previous_hash}".encode('utf-8'))
        return sha.hexdigest()
```

---

## Rust

```rust
#[derive(Debug)]
struct Point {
    x: f64,
    y: f64,
}

fn main() {
    let point = Point { x: 1.0, y: 2.0 };
    println!("Point coordinates: {:?}", point);
    
    let result: Option<i32> = Some(42);
    match result {
        Some(val) => println!("Value is: {}", val),
        None => println!("No value found"),
    }
}
```

---

## Go

```go
package main

import (
	"fmt"
	"net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello, World! Requested: %s", r.URL.Path)
}

func main() {
	http.HandleFunc("/", handler)
	fmt.Println("Server starting on port 8080...")
	http.ListenAndServe(":8080", nil)
}
```

---

## Bash / Shell (sh)

```bash
#!/bin/bash
# Backup script

SOURCE_DIR="/var/log"
BACKUP_DIR="/backup"
DATE=$(date +%Y-%m-%d)

if [ ! -d "$BACKUP_DIR" ]; then
  mkdir -p "$BACKUP_DIR"
fi

tar -czf "$BACKUP_DIR/log_backup_$DATE.tar.gz" -C "$SOURCE_DIR" .
echo "Backup completed: log_backup_$DATE.tar.gz"
```

---

## JSON

```json
{
  "name": "vscode-extension-markdown-explorer",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "chart.js": "^4.4.0",
    "mermaid": "^10.0.0"
  },
  "enabled": true,
  "config": null
}
```

---

## CSS / SCSS

```css
/* Styling for cards */
.card-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 10px;
}

.card-item:hover {
  background: var(--bg-h);
  border-color: var(--accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

---

## HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
</head>
<body>
  <div class="container" id="main">
    <h1>Hello, World!</h1>
    <p class="description">Syntax highlighting tester.</p>
  </div>
</body>
</html>
```

---

## SQL

```sql
SELECT users.id, users.name, COUNT(orders.id) AS order_count
FROM users
LEFT JOIN orders ON users.id = orders.user_id
WHERE users.role = 'premium' AND orders.created_at >= '2026-01-01'
GROUP BY users.id
ORDER BY order_count DESC
LIMIT 10;
```

---

## Diff

```diff
- const found = this._flat?.find(f => f.fsPath === href);
+ const normHref = this._normPath(href);
+ const found = this._flat?.find(f =>
+   this._normPath(f.fsPath) === normHref ||
+   this._normPath(f.relativePath) === normHref
+ );
  if (found) {
    this._currentFile = found.fsPath;
    await this._sendContent();
+ } else {
+   await this._panel.webview.postMessage({ command: 'navNotFound', href });
  }
```
