/*jshint node:true*/

const PackageMerger = require("package-merger");
const path = require("path");
const fetch = require("node-fetch");
const fs = require("fs");
const inquirer = require('inquirer');

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
    availableOptions: [{
      name: 'dry-run',
      type: Boolean,
      default: false,
      aliases: ['d']
    }, {
      name: 'target',
      type: String,
      default: '2.13.0-beta.2',
      aliases: ['t']
    }, {
      name: 'interactive',
      type: Boolean,
      default: false,
      aliases: ['i']
    }, ],
    description: "merge packages",
    run: function (options) {
      const ourPkg = this.project.pkg; // host addon's package.json
      return fetchDeps(ourPkg)
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

          if (ourPkg.dependencies) {
            if (options.interactive) {
              promise = promise.then(() => promptMerge(merge.dependencies));
            }

            promise = promise
              .then(() => performMerge(merge.dependencies, ourPkg.dependencies))
              .then(() => ourPkg.dependencies = sortObject(ourPkg.dependencies));
          }

          if (ourPkg.devDependencies) {
            if (options.interactive) {
              promise = promise.then(() => promptMerge(merge.devDependencies));
            }

            promise = promise
              .then(() => performMerge(merge.devDependencies, ourPkg.devDependencies))
              .then(() => ourPkg.devDependencies = sortObject(ourPkg.devDependencies));
          }

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

function promptMerge(dependencies) {
  return promptCheckbox('add', dependencies.add).then((deps) => dependencies.add = deps)
  .then(() => promptCheckbox('change', dependencies.change)).then((deps) => dependencies.change = deps)
  .then(() => promptCheckbox('remove', dependencies.remove)).then((deps) => dependencies.remove = deps)
}

function promptCheckbox(mergeType, dependencies) {
  if (dependencies.length === 0) {
    return Promise.resolve([]);
  }

  return inquirer.prompt({
      type: 'checkbox',
      name: 'checked',
      message: `Select packages you would like to ${mergeType}`,
      choices: dependencies.map((dependency) => {
        return {
          value: dependency,
          name: `${dependency.name} => ${dependency.version}`
        };
      })
    })
    .then(({
      checked
    }) => checked);
}

function performMerge(mergeDependencies, ourDependencies = {}) {
  mergeDependencies.add.map((dep) => ourDependencies[dep.name] = dep.version);
  mergeDependencies.remove.map((dep) => delete ourDependencies[dep.name]);
  mergeDependencies.change.map((dep) => ourDependencies[dep.name] = dep.version);
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
