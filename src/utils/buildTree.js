
const buildTree = (categories) => {
  const map = {};
  const roots = [];

  // Step 1: index all categories by _id
  categories.forEach(cat => {
    map[cat._id.toString()] = { ...cat, children: [] };
  });

  // Step 2: assign children to their parents
  categories.forEach(cat => {
    if (cat.parentId) {
      const parent = map[cat.parentId.toString()];
      if (parent) {
        parent.children.push(map[cat._id.toString()]);
      }
    } else {
      roots.push(map[cat._id.toString()]);
    }
  });

  return roots;
};

module.exports = buildTree;