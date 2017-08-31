var cp = require('child_process');
var _camel = require('lodash.camelcase');

module.exports = function HerokuAddonPool(id, app, opt) {
  var unused = [];
  var supply = new Map();
  var removed = new Map();
  var pending = new Map();

  var log = function(msg) {
    if(opt.log) console.log(`${id}.${msg}`);
  };

  var supplySetOne = function(cfg) {
    return new Promise((fres, frej) => {
      var w = cfg.split('=');
      if(w[0].search(opt.config)<0) return;
      var key = _camel(w[0].substring(0, w[0].length-4));
      var val = {'value': w[1].substring(1, w[1].length-1)};
      cp.exec(`~/heroku addons:info ${key} --app ${app}`, (err, stdout) => {
        if(err) return frej(err);
        for(var r of stdout.toString().match(/[^\r\n]+/g)) {
          var k = r.startsWith('=')? 'name' : r.match(/\S+/g);
          val[k] = r.substring(r.match(/[\S\s]+(=|:)\s+/g));
        }
        log(`supplySetOne(${key})`);
        supply.set(key, val);
        fres(key);
      });
    });
  };

  var supplySet = function() {
    return new Promise((fres, frej) => {
      cp.exec(`~/heroku config -s --app ${app}`, (err, stdout) => {
        if(err) return frej(err);
        var pro = Promise.resolve();
        for(var cfg of stdout.toString().match(/[^\r\n]+/g))
          pro = pro.then(() => supplySetOne(cfg));
        pro.then(() => fres(supply));
      });
    });
  };

  var setup = function() {
    log(`setup()`);
    return supplySet().then((ans) => {
      for(var key of supply.keys())
        unused.push(key);
      return ans;
    });
  };

  var remove = function(ref) {
    return new Promise((fres) => {
      if(unused.length===0) {
        log(`remove:addToPending(${ref})`);
        return pending.set(ref, fres);
      }
      var key = unused.shift();
      removed.set(ref, key);
      log(`remove:getFromUnused(${ref}, ${key})`);
      fres(key);
    });
  };

  var supplyReset = function(key) {
    log(`supplyReset(${key})`);
    var plan = supply.get(key).plan;
    return new Promise((fres, frej) => {
      cp.exec(`~/heroku addons:destroy ${key} --app ${app} --confirm ${app}`, (err) => {
        if(err) return frej(err);
        cp.exec(`~/heroku addons:create ${plan} --as ${key} --app ${app}`, (err) => {
          if(err) return frej(err);
          supplySet().then((ans) => {
            fres(ans.get(key));
          });
        });
      });
    });
  };

  var pendingRemove = function() {
    if(!unused.length || !pending.size) return;
    var ref = pending.keys().next().value;
    var fres = pending.get(ref);
    pending.delete(ref);
    var key = unused.shift();
    removed.set(ref, key);
    log(`pendingRemove:setRemoved(${ref}, ${key})`);
    fres(key);
    return ref;
  };

  var add = function(ref) {
    if(pending.has(ref)) {
      log(`add:deleteFromPending(${ref})`);
      pending.delete(ref);
    }
    if(removed.has(ref)) {
      var key = removed.get(ref);
      removed.delete(ref);
      log(`add:deleteFromRemoved(${ref}, ${key})`);
      return supplyReset(key).then(() => {
        unused.push(key);
        pendingRemove();
        return ref;
      });
    }
    return Promise.resolve(ref);
  };

  var get = function(key) {
    return supply.get(key);
  };

  return {get, add, remove, setup};
};
