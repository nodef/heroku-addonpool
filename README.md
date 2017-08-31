# heroku-addonpool

[![NPM](https://nodei.co/npm/heroku-addonpool.png)](https://nodei.co/npm/heroku-addonpool/)

Manage Addon Pool of an App in Heroku.

```javascript
var Pool = require('heroku-addonpool');
// Pool(<id>, <app>, <opt>)

var pool = Pool('postgresql', 'myapp', {
  'name': 'heroku-postgresql:hobbydev',
  'config': /(HEROKU_POSTGRESQL|DATABASE)\S*URL/g,
  'log': true
});

// Now say "mpapp" has only 2 heroku-postgresql addons provisioned
// And, there are a number of PostgreSQL DB URL consumers (>2)
// Only consumers will be able to remove (get) the database at a time
// After a consumer is done working with it, it can be added back to pool
// Another waiting consumer is provided with URL of the PostgreSQL database

pool.setup().then(() => {
  pool.remove(0).then((ans) => {
    console.log(`PostgreSQL0 Config Var: ${ans}`);
    console.log(`PostgreSQL0 URL: ${pool.get(ans)}`);
    setTimeout(() => pool.add(0), 10000);
    // add back to pool after 10s
  }).then(() => {
    return pool.remove(1);
  }).then((ans) => {
    console.log(`PostgreSQL1 Config Var: ${ans}`);
    console.log(`PostgreSQL1 URL: ${pool.get(ans)}`);
  }).then(() => {
    return pool.remove(2);
  }).then((ans) => {
    // gets called after consumer 0 adds back (10s later)
    console.log(`PostgreSQL2 Config Var: ${ans}`);
    console.log(`PostgreSQL2 URL: ${pool.get(ans)}`);
  });
});
```
