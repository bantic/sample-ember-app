/*jshint node:true*/

let PackageMerger = require("package-merger");
const path = require("path");
const fetch = require("node-fetch");

function fetchPackageContents(path) {
    // source = https://raw.githubusercontent.com/ember-cli/ember-new-output/v2.11.1/package.json
    // fetch('https://raw.githubusercontent.com/ember-cli/ember-new-output/master/package.json')
    // theirs = https://raw.githubusercontent.com/ember-cli/ember-new-output/v2.13.0-beta.2/package.json
    return fetch(path)
    .then(res => res.json())
    // .then(json => console.log(json))
}

function fetchDeps(ourPackage) {
  // console.log("called fetchDeps");

  //  source = 2.11.1
  //  ours = package.json (local)
  //  theirs = new version 2.13.beta.2

  return new Promise((resolve, reject) => {
    // console.log("inside fetchDeps promise");
    // const package = this.package;
    const sourcePath = 'https://raw.githubusercontent.com/ember-cli/ember-new-output/v2.11.1/package.json';
    //sourcePath = 'https://raw.githubusercontent.com/ember-cli/ember-new-output/master/package.json';
    const theirsPath = 'https://raw.githubusercontent.com/ember-cli/ember-new-output/v2.13.0-beta.2/package.json';

    fetchPackageContents(sourcePath)
      .then((source) => {
        fetchPackageContents(theirsPath)
          .then((theirs) => {
            return resolve({
              source: { dependencies: source.dependencies, devDependencies: source.devDependencies },
              ours: { dependencies: ourPackage.dependencies, devDependencies: ourPackage.devDependencies },
              theirs: { dependencies: theirs.dependencies, devDependencies: theirs.devDependencies }
            });
          })
      })
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
      const ourPkg = this.project.pkg; // host addon's package.json
      return fetchDeps(ourPkg)
        .then(({ source, ours, theirs }) => {
          let merge = PackageMerger.merge({ source, ours, theirs });
          performMerge(merge.devDependencies, ourPkg.devDependencies);
          performMerge(merge.dependencies, ourPkg.dependencies);
          if (ourPkg.dependencies) {
            ourPkg.dependencies = sortObject(ourPkg.dependencies);
          }

          ourPkg.devDependencies = sortObject(ourPkg.devDependencies);
          console.log(JSON.stringify(ourPkg));
          // console.log("merge data ----------------------", JSON.stringify(merge));
        })
        .catch(e => {
          // console.log("caught error", e);
        });
    }
  };
}

function performMerge(mergeDependencies, ourDependencies = {}) {
  mergeDependencies.change = mergeDependencies.change.concat(mergeDependencies.add);
  mergeDependencies.remove.map((dep) => delete ourDependencies[dep.name]);
  mergeDependencies.change.map((dep) => ourDependencies[dep.name] = dep.version);
}

function sortObject(o = {}) {
  return Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {});
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
