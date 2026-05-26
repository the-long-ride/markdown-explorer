# 🧪 Test: Markdown List Items & Nesting

This document provides a comprehensive test suite for all markdown list items, task lists, custom start indexes, loose spacing, and multi-level nesting configurations.

---

## 1. Standard Ordered & Unordered Lists

### Unordered List
- Apple
- Banana
- Cherry

### Ordered List
1. First step
2. Second step
3. Third step

---

## 2. Nested Lists (Multi-Level)

### Unordered Nested inside Ordered
1. Fruits
   - Red Fruits
     - Strawberry
     - Apple
   - Yellow Fruits
     - Banana
     - Lemon
2. Vegetables
   - Green Vegetables
     - Broccoli
     - Spinach

### Ordered Nested inside Unordered
- Shopping List
   1. Buy milk
   2. Buy bread
- Todo List
   1. Clean room
   2. Water plants

---

## 3. Task Lists

- [ ] Uncompleted task item
- [x] Completed task item
- [ ] Task list with nested items
   - [x] Nested completed item
   - [ ] Nested uncompleted item
   1. Step-by-step tasks
      - [ ] Sub-task A
      - [x] Sub-task B

---

## 4. Loose Lists (Blank Lines)

1. First loose item

2. Second loose item

3. Third loose item

- Loose bullet A

- Loose bullet B

---

## 5. Custom Start Index

5. Starting at five
6. Element six
7. Element seven

100. Starting at one hundred
101. Element one hundred and one

---

## 6. Complex Nested Blocks

1. List item containing a paragraph:
   This is an indented paragraph inside the first list item. It should remain grouped under the same list item.

2. List item containing a blockquote:
   > This is a nested blockquote inside the second list item.
   > It should be styled appropriately.

3. List item containing code:
   `inline code highlight` inside the list item text.
