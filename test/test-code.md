# 🧪 Test: Code Blocks & Syntax Highlighting

This document tests syntax highlighting across all supported programming languages.

---

## HTML (Isolated Sandbox Preview)

```html
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  .snake-game {
    width: min(100%, 520px);
    margin: 0 auto;
    padding: 16px;
    border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
    border-radius: 14px;
    background: color-mix(in srgb, Canvas 94%, #6d5ef0 6%);
    font: 14px/1.4 system-ui, sans-serif;
  }
  .snake-game__header,
  .snake-game__controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .snake-game__score { font-weight: 700; }
  #snake-game-canvas {
    display: block;
    width: min(100%, 420px);
    aspect-ratio: 1;
    margin: 14px auto;
    border: 2px solid color-mix(in srgb, currentColor 34%, transparent);
    border-radius: 10px;
    background: #111827;
  }
  .snake-game button {
    min-width: 84px;
    padding: 8px 12px;
    border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, Canvas 88%, #6d5ef0 12%);
    color: CanvasText;
    cursor: pointer;
    font-weight: 700;
  }
  .snake-game button:hover,
  .snake-game button:focus-visible { border-color: #6d5ef0; outline: none; }
  .snake-game__hint { margin: 10px 0 0; text-align: center; opacity: .72; }
</style>

<div class="snake-game" id="snake-game" tabindex="0" aria-label="Interactive Snake game">
  <div class="snake-game__header">
    <strong>Markdown Explorer Snake</strong>
    <span class="snake-game__score">Score: <span id="snake-score">0</span> · Best: <span id="snake-best">0</span></span>
  </div>
  <canvas id="snake-game-canvas" width="420" height="420" aria-label="Snake game board"></canvas>
  <div class="snake-game__controls">
    <button id="snake-start" type="button">Start</button>
    <button id="snake-pause" type="button">Pause</button>
    <button id="snake-restart" type="button">Restart</button>
  </div>
  <p class="snake-game__hint">Use Arrow keys or WASD. Click the game first so keyboard input stays inside the sandbox.</p>
</div>

<script>
(() => {
  const root = document.getElementById('snake-game');
  const canvas = document.getElementById('snake-game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('snake-score');
  const bestEl = document.getElementById('snake-best');
  const startButton = document.getElementById('snake-start');
  const pauseButton = document.getElementById('snake-pause');
  const restartButton = document.getElementById('snake-restart');
  const cells = 21;
  const cell = canvas.width / cells;
  const tickMs = 105;
  let snake;
  let direction;
  let queuedDirection;
  let food;
  let score;
  let best = 0;
  let running = false;
  let paused = false;
  let lastTick = 0;
  let frameId = 0;

  const randomFood = () => {
    let next;
    do {
      next = { x: Math.floor(Math.random() * cells), y: Math.floor(Math.random() * cells) };
    } while (snake.some(part => part.x === next.x && part.y === next.y));
    return next;
  };

  const reset = () => {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    direction = { x: 1, y: 0 };
    queuedDirection = direction;
    score = 0;
    scoreEl.textContent = '0';
    paused = false;
    pauseButton.textContent = 'Pause';
    food = randomFood();
    draw();
  };

  const drawCell = (position, color, inset = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(position.x * cell + inset, position.y * cell + inset, cell - inset * 2, cell - inset * 2);
  };

  const draw = () => {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,.045)';
    for (let i = 1; i < cells; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke();
    }
    drawCell(food, '#fb7185', 2);
    snake.forEach((part, index) => drawCell(part, index === 0 ? '#a78bfa' : '#34d399', 1.5));
  };

  const stop = (message) => {
    running = false;
    cancelAnimationFrame(frameId);
    draw();
    ctx.fillStyle = 'rgba(17,24,39,.72)';
    ctx.fillRect(0, canvas.height / 2 - 34, canvas.width, 68);
    ctx.fillStyle = '#f9fafb';
    ctx.textAlign = 'center';
    ctx.font = '700 22px system-ui';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 8);
  };

  const step = () => {
    direction = queuedDirection;
    const head = {
      x: (snake[0].x + direction.x + cells) % cells,
      y: (snake[0].y + direction.y + cells) % cells,
    };
    if (snake.some(part => part.x === head.x && part.y === head.y)) {
      stop('Game over — press Restart');
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      best = Math.max(best, score);
      scoreEl.textContent = String(score);
      bestEl.textContent = String(best);
      food = randomFood();
    } else {
      snake.pop();
    }
    draw();
  };

  const loop = (time) => {
    if (!running) return;
    if (!paused && time - lastTick >= tickMs) {
      lastTick = time;
      step();
    }
    frameId = requestAnimationFrame(loop);
  };

  const begin = () => {
    root.focus();
    if (running) return;
    running = true;
    paused = false;
    lastTick = performance.now();
    frameId = requestAnimationFrame(loop);
  };

  const changeDirection = (x, y) => {
    if (direction.x + x === 0 && direction.y + y === 0) return;
    queuedDirection = { x, y };
  };

  document.addEventListener('keydown', event => {
    const controls = {
      ArrowUp: [0, -1], KeyW: [0, -1],
      ArrowDown: [0, 1], KeyS: [0, 1],
      ArrowLeft: [-1, 0], KeyA: [-1, 0],
      ArrowRight: [1, 0], KeyD: [1, 0],
    };
    const next = controls[event.code];
    if (!next) return;
    event.preventDefault();
    changeDirection(next[0], next[1]);
    begin();
  });

  startButton.addEventListener('click', begin);
  pauseButton.addEventListener('click', () => {
    if (!running) return;
    paused = !paused;
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    root.focus();
  });
  restartButton.addEventListener('click', () => {
    cancelAnimationFrame(frameId);
    running = false;
    reset();
    begin();
  });

  reset();
})();
</script>
```

---

## CSV Preview — Monthly Variant Downloads

```csv
Month,Electron,Tauri,VS Code,Chromium,Website App,Total
2025-01,1240,610,2840,930,720,6340
2025-02,1325,655,2960,1010,780,6730
2025-03,1410,702,3125,1095,845,7177
2025-04,1498,748,3290,1170,910,7616
2025-05,1585,795,3470,1255,980,8085
2025-06,1690,842,3660,1340,1055,8587
2025-07,1815,905,3895,1450,1140,9205
2025-08,1940,968,4120,1565,1235,9828
2025-09,2075,1035,4380,1690,1330,10510
2025-10,2210,1108,4650,1825,1435,11228
2025-11,2360,1182,4935,1970,1540,11987
2025-12,2525,1260,5240,2125,1660,12810
2026-01,2700,1345,5580,2290,1790,13705
2026-02,2885,1435,5930,2470,1930,14650
2026-03,3090,1530,6310,2665,2080,15675
2026-04,3310,1632,6720,2875,2240,16777
2026-05,3545,1740,7160,3100,2410,17955
2026-06,3800,1855,7635,3345,2595,19230
2026-07,4075,1978,8140,3605,2790,20588
2026-08,4370,2108,8680,3885,3000,22043
```

---

## Headerless CSV Preview

```csv noheader
Desktop,1250,true
Tauri,840,true
VS Code,2840,true
Chromium,930,false
Website App,720,false
```
## XML with Declaration

```xml
<?xml version="1.0" encoding="UTF-8"?>
<catalog generated="2026-07-26">
  <workshop id="oak-studio" active="true">
    <name>Oak &amp; Grain Workshop</name>
    <location country="VN">Da Nang</location>
  </workshop>
</catalog>
```

---

## YAML Configuration (Alias Highlighting)

```yml
workspace:
  title: Markdown Explorer
  enabled: true
  retries: 3
```

---

## XML Fragment without Declaration

```xml
<catalog source="local">
  <item sku="ME-DESKTOP" downloads="1250">Desktop</item>
  <item sku="ME-TAURI" downloads="840">Tauri</item>
  <item sku="ME-WEB" downloads="630">Website</item>
</catalog>
```

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


---
