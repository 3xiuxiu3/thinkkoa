/**
 * loader
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/4/27
 */
const lib = require('think_lib');
const loader = require('think_loader');
const logger = require('think_logger');

//default middleware list
const defaultList = ['trace', 'static', 'payload', 'router'];
//auto load config
const loaderConf = {
    'configs': {
        root: 'config',
        prefix: '',
    },
    'controllers': {
        root: 'controller',
        prefix: '',
    },
    'middlewares': {
        root: 'middleware',
        prefix: '',
    },
    'models': {
        root: 'model',
        prefix: '',
    },
    'services': {
        root: 'service',
        prefix: '',
    }
};

module.exports = {
    /**
     * Load configuration
     * 
     * @param {any} app 
     */
    loadConfigs: function (app) {
        let configs = loader(app.think_path + '/lib', loaderConf.configs);
        configs = lib.extend(configs, loader(app.app_path, loaderConf.configs), true);
        //触发记录日志
        if (configs.config) {
            app.emit('logs', [configs.config.logs, configs.config.logs_path, configs.config.logs_level]);
        }
        // lib.define(app._caches, 'configs', configs);
        app._caches.configs = null;
        app._caches.configs = configs;
        //向下兼容
        app.configs = app._caches.configs;
    },
    /**
     * Load middleware
     * 
     * @param {any} app 
     * @param {boolean} [run=true] 
     */
    loadMiddlewares: function (app, run = true) {
        let configs = app._caches.configs || {};
        
        //Mount application middleware
        if (configs.middleware.list && configs.middleware.list.length > 0) {
            configs.middleware.list.forEach(item => {
                if (!defaultList.includes(item) && item !== 'controller') {
                    defaultList.push(item);
                }
            });
        }

        //Mount the controller middleware
        if (!defaultList.includes('controller')){
            defaultList.push('controller');
        }
        //de-duplication
        let appMList = [...new Set(defaultList)];

        let middlewares = loader(app.think_path + '/lib', loaderConf.middlewares);
        //Load the application middleware
        let appMiddlewares = loader(app.app_path, loaderConf.middlewares);
        for(let n in appMiddlewares){
            if (!middlewares[n]){
                middlewares[n] = appMiddlewares[n];
            } else {
                logger.error(`Cannot override the default middleware ${n}`);
            }
        }
        lib.define(app, 'middlewares', middlewares);

        //Automatically call middleware 
        if (run) {
            appMList.forEach(key => {
                if (!key || !lib.isFunction(middlewares[key])) {
                    logger.error(`middleware ${key} load error, please check the middleware`);
                    return;
                }
                if (configs.middleware.config[key] === false) {
                    return;
                }
                if (configs.middleware.config[key] === true) {
                    app.use(middlewares[key]({}, app));
                    return;
                }
                app.use(middlewares[key](configs.middleware.config[key] || {}, app));
            });
        }
    },
    /**
     * Load the controller
     * 
     * @param {any} app 
     */
    loadControllers: function (app) {
        // app controller
        // app.controllers = loader(app.app_path, loaderConf.controllers);
        lib.define(app, 'controllers', loader(app.app_path, loaderConf.controllers));
        // muilte modules
        app.modules = [];
        if (app.controllers) {
            let modules = [];
            for (let key in app.controllers) {
                let paths = key.split('/');
                if (paths.length < 2) {
                    continue;
                }
                modules.push(paths[0]);
            }
            let unionSet = new Set([...modules]);
            // app.modules = Array.from(unionSet);
            lib.define(app, 'modules', Array.from(unionSet));
        }
    },
    /**
     * Load the application module
     * 
     * @param {any} app 
     */
    loadModules: function (app) {
        for (let key in loaderConf) {
            // Avoid repeated loading
            if (['configs', 'controllers', 'middlewares'].indexOf(key) > -1) {
                continue;
            }
            // Keep keywords
            if (key.indexOf('_') === 0) {
                logger.error('Reserved keywords are used in the load configuration');
                continue;
            }
            lib.define(app, key, loader(app.app_path, loaderConf[key]));
        }
    }
};