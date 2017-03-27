/*jshint node:true*/

const PackageMerger = require("package-merger");
const path = require("path");
const fetch = require("node-fetch");
const fs = require("fs");

function mergeCommand() {
  return {
    name: "upgrade:deps",
    availableOptions: [
      { name: 'dry-run', type: Boolean, default: false, aliases: ['d'] },
      { name: 'target',  type: String,  default: null, aliases: ['t'] }
    ],
    description: "merge packages",
    run: function(options) {
      const ourPkg = this.project.pkg; // host addon's package.json
      const pristineEmberVersion = 'v' + ourPkg.devDependencies['ember-cli'];
      const futureEmberVersion = options.target ? 'v' + options.target : "master";
      const versionInfo = { pristine: pristineEmberVersion, future: futureEmberVersion };

      // console.log(JSON.stringify(versionInfo));
      return fetchDeps(ourPkg, versionInfo)
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

          if (options.dryRun) {
            this.ui.write(JSON.stringify(ourPkg, null, 2));
          } else {
            fs.writeFileSync(path.join(this.project.root, 'package.json'), JSON.stringify(ourPkg, null, 2));
          }
        })
        .catch(e => {
          console.log("caught error", e);
        });
    }
  };
}

function fetchPackageContents(path) {
    return fetch(path)
    .then(res => res.json())
}

function fetchDeps(ours, versionInfo) {
  return new Promise((resolve, reject) => {
    const ourVersion = versionInfo.pristine;
    const theirVersion = versionInfo.future;
    const sourcePath = `https://raw.githubusercontent.com/ember-cli/ember-new-output/${ourVersion}/package.json`;
    const theirsPath = `https://raw.githubusercontent.com/ember-cli/ember-new-output/${theirVersion}/package.json`;
    fetchPackageContents(sourcePath)
      .then((source) => {
        fetchPackageContents(theirsPath)
          .then((theirs) => {
            //  source = pristine version of ember cli package.json for our project
            //  ours   = our package.json (local to parent app) in its current state
            //  theirs = the version of ember cli we want to upgrade to
            return resolve({
              source,
              ours,
              theirs,
            });
          })
      })
  });
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
