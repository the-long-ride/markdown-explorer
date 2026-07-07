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

## HTML (Isolated Sandbox Preview)

```html
<style>
  h1 {
    color: var(--accent, #6d5ef0);
    animation: bounce 1s infinite alternate;
    font-size: 1.5em;
    margin: 0 0 8px 0;
  }
  @keyframes bounce {
    from { transform: translateY(0); }
    to { transform: translateY(-5px); }
  }
  .sandbox-btn {
    background: var(--success, #10b981);
    color: #fff;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }
</style>

<div class="container" id="main" style="padding: 10px; border: 1px dashed var(--bd-x); border-radius: 8px;">
  <h1>Hello, Standalone HTML Sandbox!</h1>
  <p class="description" style="margin-bottom: 12px;">This HTML code block is rendered as an isolated live page inside an iframe.</p>
  <button class="sandbox-btn" onclick="alertMsg()">Click Me to Test JS</button>
  <div id="status" style="margin-top: 10px; font-weight: bold; color: var(--tx2);"></div>
</div>

<script>
  function alertMsg() {
    document.getElementById('status').innerText = 'JavaScript is working! Time: ' + new Date().toLocaleTimeString();
  }
</script>
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

---

## C

```c
#include <stdio.h>

// Simple main function
int main() {
    printf("Hello, C!\n");
    return 0;
}
```

---

## C++

```cpp
#include <iostream>
#include <vector>

/* Entry point */
int main() {
    std::vector<int> vec = {10, 20, 30};
    for (int num : vec) {
        std::cout << "Value: " << num << std::endl;
    }
    return 0;
}
```

---

## Java

```java
package com.test;

public class Main {
    public static void main(String[] args) {
        // Output hello statement
        System.out.println("Hello, Java!");
        int value = 100;
    }
}
```

---

## C#

```csharp
using System;

namespace HelloWorld {
    class Program {
        static void Main(string[] args) {
            string greet = "Hello, C#!";
            Console.WriteLine(greet);
        }
    }
}
```

---

## PHP

```php
<?php
// Simple PHP statement
$text = "Hello, PHP!";
echo $text;
?>
```

---

## Ruby

```ruby
# Greet method
def greet(name)
  message = "Hello, #{name}!"
  puts message
end

greet("Ruby")
```

---

## Swift

```swift
import Foundation

let language = "Swift"
// Print standard output
print("Hello, \(language)!")
```

---

## Kotlin

```kotlin
package hello

fun main() {
    val name = "Kotlin"
    println("Hello, $name!")
}
```

---

## R

```r
# Simple helper
greet <- function(name) {
  cat("Hello, ", name, "!\n", sep="")
}
greet("R")
```

---

## Scala

```scala
object HelloWorld {
  def main(args: Array[String]): Unit = {
    val message = "Hello, Scala!"
    println(message)
  }
}
```

---

## Elixir

```elixir
defmodule Greeter do
  # Elixir greet function
  def greet(name) do
    IO.puts("Hello, #{name}!")
  end
end

Greeter.greet("Elixir")
```

---

## Dart

```dart
void main() {
  var name = 'Dart';
  print('Hello, $name!');
}
```

---

## Hack

```hack
<<__EntryPoint>>
function main(): void {
  // Hack hello world
  echo "Hello, Hack!\n";
}
```

---

## Perl

```perl
use strict;
use warnings;

my $name = "Perl";
# Perl printer
print "Hello, $name!\n";
```

