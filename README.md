# Extension Service
Handles Phoenix/Brackets extensions and themes management including publishing, popularity tracking, CI integrations(Eg. from GitHub actions etc..). 

```shell
# do this to start server
cp ./src/a.json ./src/app.json
export APP_CONFIG=./src/app.json
npm install
npm run serve 

# To hit end point
curl -X GET 'http://127.0.0.1:5000/hello?name=rambo'  -H 'authorization: Basic 123' -H 'Content-Type: application/json' -v 

```

```shell
# use this for continuous reload while development 
npm run serve:dev
```

## Code Guardian

[![<app> build verification](https://github.com/phcode-dev/extensionService/actions/workflows/build_verify.yml/badge.svg)](https://github.com/phcode-dev/extensionService/actions/workflows/build_verify.yml)

<a href="https://sonarcloud.io/summary/new_code?id=phcode-dev_extensionService2">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=phcode-dev_extensionService2&metric=alert_status" alt="Sonar code quality check" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=phcode-dev_extensionService2&metric=security_rating" alt="Security rating" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=phcode-dev_extensionService2&metric=vulnerabilities" alt="vulnerabilities" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=phcode-dev_extensionService2&metric=coverage" alt="Code Coverage" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=phcode-dev_extensionService2&metric=bugs" alt="Code Bugs" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=phcode-dev_extensionService2&metric=reliability_rating" alt="Reliability Rating" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=phcode-dev_extensionService2&metric=sqale_rating" alt="Maintainability Rating" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=phcode-dev_extensionService2&metric=ncloc" alt="Lines of Code" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=phcode-dev_extensionService2&metric=sqale_index" alt="Technical debt" />
</a>

# Commands available

## Building

Since this is a pure JS template project, build command just runs test with coverage.

```shell
> npm install   // do this only once.
> npm run build
```

## Linting

To lint the files in the project, run the following command:

```shell
> npm run lint
```

To Automatically fix lint errors:

```shell
> npm run lint:fix
```

## Testing

### Run unit tests
```shell
> npm run test:unit
```

### Running integration tests locally

```shell
> npm run test:integ
```
You can edit `src/testConfig.json` to change app config for tests after running the above command.

### Running integration tests in GitHub actions
You have to set a repository secret `APP_CONFIG_FOR_INTEG_TESTS` with
content of the text config.
* Goto your repository settings https://github.com/<your org>/<your repo>/settings/secrets/actions
* Create a new `Repository secret` with name `APP_CONFIG_FOR_INTEG_TESTS` and the secret as the config file contents.
* The build verify action should now be able to use the secret.
* Note that pull requests cannot read repository secrets and subsequently cannot run integration tests.

### To run all tests:

To run all tests:

```shell
> npm run test
  Hello world Tests
    ✔ should return Hello World
    #indexOf()
      ✔ should return -1 when the value is not present
```

## Coverage Reports

To run all tests with coverage:

```shell
> npm run cover
  Hello world Tests
    ✔ should return Hello World
    #indexOf()
      ✔ should return -1 when the value is not present


  2 passing (6ms)

----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |                   
 index.js |     100 |      100 |     100 |     100 |                   
----------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 100% ( 5/5 )
Branches     : 100% ( 2/2 )
Functions    : 100% ( 1/1 )
Lines        : 100% ( 5/5 )
================================================================================
Detailed unit test coverage report: file:///template-nodejs/coverage-unit/index.html
Detailed integration test coverage report: file:///template-nodejs/coverage-integration/index.html
```

After running coverage, detailed reports can be found in the coverage folder listed in the output of coverage command.
Open the file in browser to view detailed reports.

To run unit/integration tests only with coverage

```shell
> npm run cover:unit
> npm run cover:integ
```

Sample coverage report:
![image](https://user-images.githubusercontent.com/5336369/148687351-6d6c12a2-a232-433d-ab62-2cf5d39c96bd.png)

### Unit and Integration coverage configs

Unit and integration test coverage settings can be updated by configs `.nycrc.unit.json` and `.nycrc.integration.json`.

See https://github.com/istanbuljs/nyc for config options.

# Publishing packages to NPM

## Preparing for release

Please run `npm run release` on the `main` branch and push the changes to main. The release command will bump the npm
version.

!NB: NPM publish will faill if there is another release with the same version.

## Publishing

To publish a package to npm, push contents to `npm` branch in
this repository.

## Publishing `@aicore/package*`

If you are looking to publish to package owned by core.ai, you will need access to the GitHub Organization
secret `NPM_TOKEN`.

For repos managed by [aicore](https://github.com/aicore) org in GitHub, Please contact your Admin to get access to
core.ai's NPM tokens.

## Publishing to your own npm account

Alternatively, if you want to publish the package to your own npm account, please follow these docs:

1. Create an automation access token by following
   this [link](https://docs.npmjs.com/creating-and-viewing-access-tokens).
2. Add NPM_TOKEN to your repository secret by following
   this [link](https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow)

To edit the publishing workflow, please see file: `.github/workflows/npm-publish.yml`

# Dependency updates

We use Rennovate for dependency updates: https://blog.logrocket.com/renovate-dependency-updates-on-steroids/

* By default, dep updates happen on sunday every week.
* The status of dependency updates can be viewed here if you have this repo permissions in
  github: https://app.renovatebot.com/dashboard#github/aicore/template-nodejs
* To edit rennovate options, edit the rennovate.json file in root,
  see https://docs.renovatebot.com/configuration-options/
  Refer

# Code Guardian

Several automated workflows that check code integrity are integrated into this template.
These include:

1. GitHub actions that runs build/test/coverage flows when a contributor raises a pull request
2. [Sonar cloud](https://sonarcloud.io/) integration using `.sonarcloud.properties`
    1. In sonar cloud, enable Automatic analysis from `Administration
       Analysis Method` for the first
       time ![image](https://user-images.githubusercontent.com/5336369/148695840-65585d04-5e59-450b-8794-54ca3c62b9fe.png)

## IDE setup

SonarLint is currently available as a free plugin for jetbrains, eclipse, vscode and visual studio IDEs.
Use sonarLint plugin for webstorm or any of the available
IDEs from this link before raising a pull request: https://www.sonarlint.org/ .

SonarLint static code analysis checker is not yet available as a Brackets
extension.

## Internals

### Testing framework: Mocha , assertion style: chai

See https://mochajs.org/#getting-started on how to write tests
Use chai for BDD style assertions (expect, should etc..). See move here: https://www.chaijs.com/guide/styles/#expect

### Mocks and spies:

Since it is not that straight forward to mock es6 module imports, use the follow pull request as reference to mock
imported libs:

* sample pull request: https://github.com/aicore/libcache/pull/6/files
* [setting up mocks](https://github.com/aicore/libcache/blob/485b1b6244f7022eb0a83d9f72d897fe712badbe/test/unit/setup-mocks.js)
* [using the mocks](https://github.com/aicore/libcache/pull/6/files#diff-8ea7ccf28b28a0ae7b43e468abd3e9a8bb411bb329ad5cb45eb9a93709ed8dc5R2)
  ensure to import `setup-mocks.js` as the first import of all files in tests.

#### using sinon lib if the above method doesn't fit your case

if you want to mock/spy on fn() for unit tests, use sinon. refer docs: https://sinonjs.org/

### Note on coverage suite used here:

we use c8 for coverage https://github.com/bcoe/c8. Its reporting is based on nyc, so detailed docs can be found
here: https://github.com/istanbuljs/nyc ; We didn't use nyc as it do not yet have ES module support
see: https://github.com/digitalbazaar/bedrock-test/issues/16 . c8 is drop replacement for nyc coverage reporting tool
