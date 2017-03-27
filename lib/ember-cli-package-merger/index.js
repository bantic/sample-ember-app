/*jshint node:true*/

let PackageMerger = require("package-merger");
const path = require("path");
const fetch = require("node-fetch");

function fetchPackageContents(path) {
    return fetch(path)
    .then(res => res.json())
}

function fetchDeps(ourPackage) {

  //  source = pristine version of ember cli package.json for our project
  //  ours   = our package.json (local to parent app) in its current state
  //  theirs = the version of ember cli we want to upgrade to

  return new Promise((resolve, reject) => {
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

          // dependencies
          merge.dependencies.add.map((dep) => ourPkg.dependencies[dep.name] = dep.version);
          merge.dependencies.remove.map((dep) => delete ourPkg.dependencies[dep.name]);
          merge.dependencies.change.map((dep) => ourPkg.dependencies[dep.name] = dep.version);

          // devDependencies
          merge.devDependencies.add.map((dep) => ourPkg.devDependencies[dep.name] = dep.version);
          merge.devDependencies.remove.map((dep) => delete ourPkg.devDependencies[dep.name]);
          merge.devDependencies.change.map((dep) => ourPkg.devDependencies[dep.name] = dep.version);

          // final result
          console.log(JSON.stringify(ourPkg));
        })
        .catch(e => {
          // console.log("caught error", e);
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
