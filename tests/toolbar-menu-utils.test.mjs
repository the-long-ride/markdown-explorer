import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShortcutTooltip,
  createToolbarMenuItems,
} from "../ui/src/utils/toolbar-menu.js";

test("buildShortcutTooltip appends shortcut label to tooltip copy", () => {
  assert.equal(
    buildShortcutTooltip("Toggle Sidebar", "Ctrl+b"),
    "Toggle Sidebar - (Ctrl+B)",
  );
});

test("buildShortcutTooltip leaves tooltip unchanged when no shortcut exists", () => {
  assert.equal(
    buildShortcutTooltip("Open current file in editor", ""),
    "Open current file in editor",
  );
});

test("createToolbarMenuItems returns the requested button order", () => {
  const items = createToolbarMenuItems({
    labels: {
      home: "Home",
      theme: "Theme",
      edit: "Edit",
      settings: "Settings",
    },
    tooltips: {
      home: "Welcome Page",
      theme: "Toggle light/dark mode",
      edit: "Open current file in editor",
      settings: "Settings - update available",
    },
    shortcuts: {
      home: "Ctrl+H",
      theme: "Ctrl+L",
      settings: "Ctrl+I",
    },
    canEdit: false,
  });

  assert.deepEqual(
    items.map((item) => ({
      id: item.id,
      label: item.label,
      disabled: item.disabled,
      tooltip: item.tooltip,
    })),
    [
      {
        id: "home",
        label: "Home",
        disabled: false,
        tooltip: "Welcome Page - (Ctrl+H)",
      },
      {
        id: "theme",
        label: "Theme",
        disabled: false,
        tooltip: "Toggle light/dark mode - (Ctrl+L)",
      },
      {
        id: "edit",
        label: "Edit",
        disabled: true,
        tooltip: "Open current file in editor",
      },
      {
        id: "settings",
        label: "Settings",
        disabled: false,
        tooltip: "Settings - update available - (Ctrl+I)",
      },
    ],
  );
});

test("buildShortcutTooltip uppercases lowercase single-letter shortcut keys", () => {
  assert.equal(
    buildShortcutTooltip("Expand All", "ctrl+shift+x"),
    "Expand All - (ctrl+shift+X)",
  );
});
