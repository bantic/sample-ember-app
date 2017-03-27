/*jshint node:true*/

let PackageMerger = require("package-merger");

function fetchDeps() {
  console.log("called fetchDeps");
  return new Promise((resolve, reject) => {
    console.log("inside fetchDeps promise");
    return resolve({
      source: { dependencies: {}, devDependencies: {} },
      ours: { dependencies: {}, devDependencies: {} },
      theirs: { dependencies: {}, devDependencies: {} }
    });
  });
}

function mergeCommand() {
  return {
    name: "upgrade:deps",
    availableOptions: [
      { name: 'dry-run', type: Boolean, default: false, aliases: ['d'] },
      { name: 'target',  type: String,  default: '2.13.0-beta.2', aliases: ['t'] }
    ],
    description: "merge packages",
    run: function(options) {
      console.log("I did run");
      console.log('target=', options.target);
      return fetchDeps()
        .then(({ source, ours, theirs }) => {
          console.log("after fetchDeps promise");
          let merge = PackageMerger.merge({ source, ours, theirs });
          console.log("merge data", merge);
        })
        .catch(e => {
          console.log("caught error", e);
        });
    }
  };
}

module.exports = {
  name: "ember-cli-package-merger",
  isDevelopingAddon: function() {
    return true;
  },
  includedCommands: function() {
    return { "upgrade:deps": mergeCommand() };
  }
};
