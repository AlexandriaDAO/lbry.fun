const fs = require('fs');
const path = require('path');
const ignore = require('ignore');

const ig = ignore()
  .add(fs.readFileSync('.gitignore').toString())
  .add('.git'); // Always ignore .git

const ignoreFilePrefixes = ['public', 'declarations', 'target', '.env', '.git', '.nvmrc', '.prettierrc', '.eslintrc', 'LICENSE', 'package', 'READ', 'filtered', 'generate', 'tree'];

const essentialFiles = {
  backend: ['helper', 'model', 'service'],
  pages: ['_app.js', 'index.js'],
  ui: ['components', 'declarations', 'hooks', 'service', 'styles', 'utils']
};

// Function to count lines in a file
const countLines = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (error) {
    return 0; // Return 0 if file cannot be read
  }
};

const createTree = (dir, indent = '', relativeDir = '') => {
  let tree = '';
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    // ignore directories that we can't read
    return '';
  }
  const parentDir = path.basename(dir);

  const itemsWithStats = files.map(file => {
    const fullPath = path.join(dir, file);
    try {
      const stats = fs.statSync(fullPath);
      return { file, fullPath, relativePath: path.join(relativeDir, file), stats };
    } catch (e) {
      return null;
    }
  }).filter(Boolean);

  const filteredItems = itemsWithStats.filter(item => {
    if (ignoreFilePrefixes.some(prefix => item.file.startsWith(prefix))) {
      return false;
    }
    // For directories, we check the path with and without a trailing slash
    // because patterns in .gitignore can be `dir` or `dir/`
    const pathToCheck = item.stats.isDirectory() ? item.relativePath + '/' : item.relativePath;
    return !ig.ignores(pathToCheck) && !ig.ignores(item.relativePath);
  });

  filteredItems.forEach((item, index) => {
    const { file, fullPath, relativePath, stats } = item;
    const isLastFile = index === filteredItems.length - 1;
    const shouldInclude = essentialFiles[parentDir] ? essentialFiles[parentDir].includes(file) : true;

    if (shouldInclude) {
      const lineEnd = isLastFile ? '└── ' : '├── ';

      if (stats.isDirectory()) {
        tree += `${indent}${lineEnd}${file}/\n`;
        tree += createTree(fullPath, `${indent}${isLastFile ? '    ' : '│   '}`, relativePath);
      } else {
        // Count lines for files and add the count in parentheses
        const lineCount = countLines(fullPath);
        tree += `${indent}${lineEnd}${file} (${lineCount} lines)\n`;
      }
    }
  });

  return tree;
};

const tree = createTree('.', '', '');
fs.writeFileSync('tree.txt', tree);
console.log('Essential file tree generated successfully.');