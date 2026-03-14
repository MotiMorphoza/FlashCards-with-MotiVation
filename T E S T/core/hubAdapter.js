/**
 * Hub Adapter
 * Interface to HUB_INDEX
 */
const HubAdapter = {
  index: null,

  /**
   * Initialize
   */
  init() {
    if (!window.HUB_INDEX) {
      throw new Error('HUB_INDEX not found');
    }
    
    this.index = window.HUB_INDEX;
  },

  /**
   * Get all languages
   */
  getLanguages() {
    return this.index.languages || [];
  },

  /**
   * Get branches
   */
  getBranches() {
    return this.index.branches || [];
  },

  /**
   * Build file tree for language and category
   */
  buildTree(lang, category = null) {
    const tree = {};
    
    this.index.entries.forEach(entry => {
      // Filter by category if specified
      if (category && entry.group !== category) return;
      
      // Filter by language
      if (!entry.files[lang]) return;
      
      const branch = entry.branch;
      const group = entry.group;
      
      if (!tree[branch]) tree[branch] = {};
      if (!tree[branch][group]) tree[branch][group] = [];
      
      entry.files[lang].forEach(file => {
        tree[branch][group].push({
          name: file.replace(/\.csv$/i, ''),
          file: file,
          path: `hub/${lang}/${branch}/${group}/${file}`,
          meta: {
            lang,
            branch,
            group,
            file
          }
        });
      });
    });
    
    return tree;
  },

  /**
   * Check if file exists
   */
  hasFile(lang, branch, group, file) {
    const entry = this.index.entries.find(e => 
      e.branch === branch && e.group === group
    );
    
    if (!entry || !entry.files[lang]) return false;
    
    return entry.files[lang].includes(file);
  },

  /**
   * Get file path
   */
  getFilePath(lang, branch, group, file) {
    return `hub/${lang}/${branch}/${group}/${file}`;
  },

  /**
   * Count total files
   */
  countFiles(lang = null) {
    let count = 0;
    
    this.index.entries.forEach(entry => {
      if (lang) {
        count += entry.files[lang]?.length || 0;
      } else {
        Object.values(entry.files).forEach(files => {
          count += files.length;
        });
      }
    });
    
    return count;
  }
};
