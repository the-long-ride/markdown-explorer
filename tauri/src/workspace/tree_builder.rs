use std::collections::HashMap;

use super::scanner::{FolderNode, MdFile};

pub(super) fn build_tree(flat: &[MdFile]) -> FolderNode {
    build_tree_with_empty_dirs(flat, &[])
}

/// `empty_dirs` are '/'-joined workspace-relative folders with zero entries on disk.
pub(super) fn build_tree_with_empty_dirs(flat: &[MdFile], empty_dirs: &[String]) -> FolderNode {
    let mut root = FolderNodeBuilder::root();
    for file in flat {
        root.insert_file(file, 0);
    }
    for dir in empty_dirs {
        let parts: Vec<String> = dir
            .split('/')
            .filter(|part| !part.is_empty())
            .map(str::to_string)
            .collect();
        root.ensure_dir(&parts, 0);
    }
    root.into_folder_node()
}

struct FolderNodeBuilder {
    name: String,
    path: String,
    children: Vec<FolderNodeBuilder>,
    child_indexes: HashMap<String, usize>,
    files: Vec<MdFile>,
    modified_at: u64,
}

impl FolderNodeBuilder {
    fn root() -> Self {
        Self {
            name: "root".into(),
            path: String::new(),
            children: Vec::new(),
            child_indexes: HashMap::new(),
            files: Vec::new(),
            modified_at: 0,
        }
    }

    fn child_index(&mut self, parts: &[String], depth: usize) -> usize {
        let name = &parts[depth];
        if let Some(index) = self.child_indexes.get(name) {
            return *index;
        }
        let index = self.children.len();
        self.children.push(Self {
            name: name.clone(),
            path: parts[..=depth].join("/"),
            children: Vec::new(),
            child_indexes: HashMap::new(),
            files: Vec::new(),
            modified_at: 0,
        });
        self.child_indexes.insert(name.clone(), index);
        index
    }

    fn insert_file(&mut self, file: &MdFile, depth: usize) {
        self.modified_at = self.modified_at.max(file.modified_at);
        if depth + 1 >= file.parts.len() {
            self.files.push(file.clone());
            return;
        }
        let index = self.child_index(&file.parts, depth);
        self.children[index].insert_file(file, depth + 1);
    }

    fn ensure_dir(&mut self, parts: &[String], depth: usize) {
        if depth >= parts.len() {
            return;
        }
        let index = self.child_index(parts, depth);
        self.children[index].ensure_dir(parts, depth + 1);
    }

    fn into_folder_node(self) -> FolderNode {
        FolderNode {
            name: self.name,
            path: self.path,
            children: self
                .children
                .into_iter()
                .map(FolderNodeBuilder::into_folder_node)
                .collect(),
            files: self.files,
            modified_at: self.modified_at,
        }
    }
}
