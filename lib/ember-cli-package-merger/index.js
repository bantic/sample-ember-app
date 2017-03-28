/*jshint node:true*/

const PackageMerger = require("package-merger");
const path = require("path");
const fetch = require("node-fetch");
const fs = require("fs");
const inquirer = require('inquirer');

function mergeCommand() {
  return {
    name: "upgrade:deps",
    availableOptions: [{
      name: 'dry-run',
      type: Boolean,
      default: false,
      aliases: ['d']
    }, {
      name: 'target',
      type: String,
      default: null,
      aliases: ['t']
    }, {
      name: 'interactive',
      type: Boolean,
      default: false,
      aliases: ['i']
    }, ],
    description: "Upgrade packages in package.json",
    run(options) {
      const ourPkg = this.project.pkg; // host addon's package.json
      const pristineEmberVersion = 'v' + ourPkg.devDependencies['ember-cli'];
      const futureEmberVersion = options.target ? 'v' + options.target : 'master';
      const versionInfo = {
        pristine: pristineEmberVersion,
        future: futureEmberVersion
      };

      return fetchDeps(ourPkg, versionInfo)
        .then(({
          source,
          ours,
          theirs
        }) => {
          let merge = PackageMerger.merge({
            source,
            ours,
            theirs
          });

          let promise = Promise.resolve();

          Object.keys(merge).forEach(function(key) {
            let dependencies = merge[key];
            if (options.interactive) {
              promise = promise.then(() => promptMerge(dependencies, ourPkg[key]));
            }
            promise = promise
              .then(() => performMerge(dependencies, ourPkg[key]))
              .then((deps) => ourPkg[key] = deps);
          });

          return promise.then(() => {
            if (options.dryRun) {
              this.ui.write(JSON.stringify(ourPkg, null, 2));
            } else {
              fs.writeFileSync(path.join(this.project.root, 'package.json'), JSON.stringify(ourPkg, null, 2));
            }
          });
        })
        .catch(console.log);
    }
  };
}

function promptMerge(dependencies, ourPkg) {
  return promptCheckbox('add', dependencies.add).then((deps) => dependencies.add = deps)
    .then(() => promptCheckbox('change', dependencies.change, ourPkg)).then((deps) => dependencies.change = deps)
    .then(() => promptCheckbox('remove', dependencies.remove)).then((deps) => dependencies.remove = deps)
}

function promptCheckbox(mergeType, dependencies, ourPkg) {
  if (dependencies.length === 0) {
    return Promise.resolve([]);
  }

  return inquirer.prompt({
      type: 'checkbox',
      name: 'checked',
      message: `Select packages you would like to ${mergeType}`,
      choices: dependencies.map((dependency) => {
        let name = `${dependency.name} = ${dependency.version}`

        switch (mergeType) {
          case 'change':
            name = `${dependency.name} ${ourPkg[dependency.name]} => ${dependency.version}`
            break;
          case 'remove':
            name = dependency.name;
            break;
        }

        return {
          value: dependency,
          name,
        };
      })
    })
    .then(({
      checked
    }) => checked);
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

function fetchPackageContents(path) {
  return fetch(path)
    .then(res => res.json())
}

function performMerge(mergeDependencies, ourDependencies = {}) {
  let result = Object.assign({}, ourDependencies);
  mergeDependencies.add.map((dep) => result[dep.name] = dep.version);
  mergeDependencies.remove.map((dep) => delete result[dep.name]);
  mergeDependencies.change.map((dep) => result[dep.name] = dep.version);
  return sortObject(result);
}

function sortObject(o = {}) {
  return Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {});
}

module.exports = {
  name: "ember-cli-package-merger",
  isDevelopingAddon: function () {
    return true;
  },
  includedCommands: function () {
    return {
      "upgrade:deps": mergeCommand()
    };
  }
};
