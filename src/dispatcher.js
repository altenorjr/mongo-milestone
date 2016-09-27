import Q from 'q';

export const METHOD_NOT_FOUND = (method) => (`The invoked method "${method}" wasn't found. Have you registered it yet?`);
export const DISPATCHER_PROPERTIES_MUST_BE_FUNCTIONS = `All properties is the Dispatcher object must be functions`;
export const DISPATCHER_KEYS_MUST_BE_STRINGS = `All properties is the Dispatcher object must be functions`;

const _dispatcher = {};

export const register = ({ name, fn, obj }) => {
    if (typeof name == 'string' && typeof fn == 'function') {
        return registerMethod(name, fn);
    }
    else if (typeof fn == 'function') {
        const result = fn();

        return registerMethods(result);
    }
    else {
        return registerMethods(obj);
    }
}

export const unregister = (name) => {
    if (typeof name === 'string') {
        return unregisterMethod(name);
    }

    if (name === false) {
        return unregisterAll();
    }
};

export const dispatch = (name, parameters) => {
    const method = _dispatcher[name];

    if (!method) {
        throw new Error(METHOD_NOT_FOUND(name));
    }

    let result;

    try {
        const result = method(parameters);

        if (!Q.isPromiseAlike(result)) {
            return Q.fcall(() => (result));
        }
        else {
            return result;
        }
    }
    catch (e) {
        return Q.fcall(() => (e));
    }
}

export const registeredMethods = () => {
    return Object.assign({}, _dispatcher);
}

const registerMethods = (registeredDispatcher) => {
    var methodNames = Object.keys(registeredDispatcher);

    if (methodNames.find(name => !name || typeof name !== 'string')) {
        throw new Error(DISPATCHER_KEYS_MUST_BE_STRINGS);
    }

    if (methodNames.find(name => !registeredDispatcher[name] || typeof registeredDispatcher[name] === 'function')) {
        throw new Error(DISPATCHER_PROPERTIES_MUST_BE_FUNCTIONS);
    }

    for (const methodName of methodNames) {
        _dispatcher[methodName] = registeredDispatcher[methodName];
    }

    return _dispatcher;
}

const registerMethod = (name, method) => {
    if (!name || typeof name !== 'string') {
        throw new Error(DISPATCHER_KEYS_MUST_BE_STRINGS);
    }

    if (!method || typeof method !== 'function') {
        throw new Error(DISPATCHER_PROPERTIES_MUST_BE_FUNCTIONS);
    }

    _dispatcher[name] = method;

    return _dispatcher;
}

const unregisterAll = () => {
    var methods = Object.keys(_dispatcher);

    for (const method of methods) {
        delete _dispatcher[method];
    }

    return _dispatcher;
};

const unregisterMethod = () => {
    for (const method of arguments) {
        delete _dispatcher[method];
    }

    return _dispatcher;
}