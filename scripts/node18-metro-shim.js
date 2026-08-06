const os = require('os');

if (typeof os.availableParallelism !== 'function') {
  os.availableParallelism = () => os.cpus()?.length ?? 1;
}

if (typeof Array.prototype.toReversed !== 'function') {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value() {
      return [...this].reverse();
    },
  });
}

if (typeof Array.prototype.toSorted !== 'function') {
  Object.defineProperty(Array.prototype, 'toSorted', {
    value(compareFn) {
      return [...this].sort(compareFn);
    },
  });
}

if (typeof Array.prototype.toSpliced !== 'function') {
  Object.defineProperty(Array.prototype, 'toSpliced', {
    value(start, deleteCount, ...items) {
      const copy = [...this];
      copy.splice(start, deleteCount, ...items);
      return copy;
    },
  });
}
