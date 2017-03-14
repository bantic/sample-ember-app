# sample-ember-app

Example spike of creating an in-repo-addon that provides a "upgrade:deps"
command.

Must have a locally `npm link`'d version of https://github.com/bantic/package-merger.

Todos:

  * [ ] accept a "target" ember-cli version command-line argument
  * [ ] implement the `fetchDeps` method
  * [ ] add code that will actually modify the package.json file to match the
    output of package-merger
  * [ ] nice UI
  * ...
