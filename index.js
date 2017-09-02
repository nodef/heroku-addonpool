'use strict';
const cp = require('child_process');
const _camel = require('lodash.camelcase');

module.exports = function HerokuAddonPool(id, app, opt) {
  const unused = [];
  const supply = new Map();
  const removed = new Map();
  const pending = new Map();
  opt = opt||{};
  opt.config = opt.config||/\S*/g;
  opt.log = opt.log||false;

  const log = function(msg) {
    if(opt.log) console.log(`${id}.${msg}`);
  };

  const supplySetOne = function(cfg) {
    return new Promise((fres, frej) => {
      const w = cfg.split('=');
      if(w[0].search(opt.config)<0) return;
      const key = w[0].substring(0, w[0].length-4);
      const val = {'value': w[1].substring(1, w[1].length-1)};
      cp.exec(`~/heroku addons:info ${key} --app ${app}`, (err, stdout) => {
        if(err) return frej(err);
        for(var r of stdout.toString().match(/[^\r\n]+/g)) {
          var k = _camel(r.startsWith('=')? 'name' : r.split(':')[0]);
          val[k] = r.substring(r.match(/[\S\s]+(=|:)\s+/g)[0].length);
        }
        supply.set(key, val);
        fres(key);
      });
    });
  };

  const supplySet = function() {
    return new Promise((fres, frej) => {
      cp.exec(`~/heroku config -s --app ${app}`, (err, stdout) => {
        if(err) return frej(err);
        var pro = Promise.resolve();
        for(var cfg of stdout.toString().match(/[^\r\n]+/g)||[])
          ((val) => pro = pro.then(() => supplySetOne(val)))(cfg);
        pro.then(() => fres(supply));
      });
    });
  };

  const setup = function() {
    log(`setup()`);
    return supplySet().then((ans) => {
      for(var key of supply.keys()) {
        log(`setup:addUnused(${key})`);
        unused.push(key);
      }
      return ans;
    });
  };

  const remove = function(ref) {
    return new Promise((fres) => {
      if(unused.length===0) {
        log(`remove:addPending(${ref})`);
        return pending.set(ref, fres);
      }
      const key = unused.shift();
      removed.set(ref, key);
      log(`remove:getUnused(${ref}, ${key})`);
      fres(supply.get(key));
    });
  };

  const supplyReset = function(key) {
    log(`supplyReset(${key})`);
    const plan = supply.get(key).plan;
    return new Promise((fres, frej) => cp.exec(
      `~/heroku addons:destroy ${key} -a ${app} --confirm ${app} >/dev/null && `+
      `~/heroku addons:create ${plan} --as ${key} -a ${app} >/dev/null && `+
      `~/heroku config -s --app ${app} | grep ^${key}`,
      (err, stdout) => {
        const r = stdout.toString();
        supply.get(key).value = r.substring(r.indexOf('=')+2, r.length-1);
      }
    ));
  };

  const pendingRemove = function() {
    if(!unused.length || !pending.size) return;
    const ref = pending.keys().next().value;
    const fres = pending.get(ref);
    pending.delete(ref);
    const key = unused.shift();
    removed.set(ref, key);
    log(`pendingRemove:getUnused(${ref}, ${key})`);
    fres(supply.get(key));
    return ref;
  };

  const add = function(ref) {
    if(pending.has(ref)) {
      log(`add:removePending(${ref})`);
      pending.delete(ref);
    }
    if(removed.has(ref)) {
      const key = removed.get(ref);
      removed.delete(ref);
      log(`add:addUnused(${ref}, ${key})`);
      return supplyReset(key).then(() => {
        unused.push(key);
        pendingRemove();
        return ref;
      });
    }
    return Promise.resolve(ref);
  };

  return {add, remove, setup};
};
