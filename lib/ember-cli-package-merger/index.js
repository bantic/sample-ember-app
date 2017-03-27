/*jshint node:true*/

const PackageMerger = require("package-merger");
const path = require("path");
const fetch = require("node-fetch");
const fs = require("fs");

function fetchPackageContents(path) {
    return fetch(path)
    .then(res => res.json())
}

function fetchDeps(ours) {

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
              source,
              ours,
              theirs,
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

          if (ourPkg.dependencies) {
            performMerge(merge.dependencies, ourPkg.dependencies);
            ourPkg.dependencies = sortObject(ourPkg.dependencies);
          }

          if (ourPkg.devDependencies) {
            performMerge(merge.devDependencies, ourPkg.devDependencies);
            ourPkg.devDependencies = sortObject(ourPkg.devDependencies);
          }

          console.log(JSON.stringify(ourPkg));
          fs.writeFileSync()
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
