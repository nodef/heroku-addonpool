# heroku-addonpool

[![Greenkeeper badge](https://badges.greenkeeper.io/nodef/heroku-addonpool.svg)](https://greenkeeper.io/)

[![NPM](https://nodei.co/npm/heroku-addonpool.png)](https://nodei.co/npm/heroku-addonpool/)

Manage Addon Pool of an App in Heroku.

```bash
# NOTE:
# The app with addons (pool app) must be different from the app
# that uses the addons because heroku resets the pool app each
# time a configuration variable is changed.
```
```bash
# set heroku cli login in environment variables
HEROKU_CLI_LOGIN=youremail@domain.com
HEROKU_CLI_PASSWORD=yourpassword

# also as of now you also need to purge cache before build
heroku repo:purge_cache -a yourpoolapp
```
```javascript
var Pool = require('heroku-addonpool');
// Pool(<id>, <app>, <opt>)

/* Assume "ci-herokuaddonpool" has 2 postgresql addons provisioned.
 * There are 3 consumers which need access to a postgresql database,
 * for a limited amount of time. Since we have only 2 available, we
 * create a pool to enable consumers to acquire (remove) and release
 * (add) database from the pool. If no database is available in the
 * pool, a consumer will have to wait (Promise) until the resource
 * is released by some other consumer.
 */

var pg = Pool('heroku-postgresql', 'ci-herokuaddonpool', {
  'config': /(HEROKU_POSTGRESQL|DATABASE)\S*URL/g,
  'log': true
});

pg.setup().then((ans) => {
  var cona = 'consumer-a';
  var conb = 'consumer-b';
  var conc = 'consumer-c';
  console.log(ans);      // available addons (Map)
  console.log(ans.size); // number of addons
  pg.remove(cona).then((ans) => {
    console.log(ans.name);        // name of the addon
    console.log(ans.attachments); // app to addon attachments
    console.log(ans.installedAt); // provision date
    console.log(ans.owningApp);   // owner app of this addon
    console.log(ans.plan);        // addon service:plan
    console.log(ans.price);       // addon price
    console.log(ans.state);       // addon state
    console.log(ans.value);       // addon access url
    console.log(`${cona} has acquired ${ans.name}`);
    console.log(`-> connection string: ${ans.value}`);
    // consumer-a uses database for 20s
    setTimeout(() => {
      console.log(`${cona} is releasing ${ans.name}`);
      pg.add(cona);
    }, 20000);
  }).then(() => {
    return pg.remove(conb);
  }).then((ans) => {
    console.log(`${conb} has acquired ${ans.name}`);
    console.log(`-> connection string: ${ans.value}`);
    // consumer-b uses database for 10s
    setTimeout(() => {
      console.log(`${conb} is releasing ${ans.name}`);
      pg.add(conb);
    }, 10000);
  }).then(() => {
    return pg.remove(conc);
  }).then((ans) => {
    // consumer-c waits for 10s until consumer-b releases
    console.log(`${conc} has acquired ${ans.name}`);
    console.log(`-> connection string: ${ans.value}`);
    // consumer-c uses database for 10s
    setTimeout(() => {
      console.log(`${conc} is releasing ${ans.name}`);
      pg.add(conc);
    }, 10000);
  });
});
```
