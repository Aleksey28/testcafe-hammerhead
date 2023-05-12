import SandboxBase from './base';
import nativeMethods from './native-methods';
import { processScript } from '../../processing/script';
import { overrideFunction } from '../utils/overriding';

export default class TimersSandbox extends SandboxBase {
    timeouts: any[];
    deferredFunctions: any[];
    setTimeout: any;

    constructor () {
        super();

        this.timeouts          = [];
        this.deferredFunctions = [];
        this.setTimeout        = nativeMethods.setTimeout;
    }

    _wrapTimeoutFunctionsArguments (args) {
        const isScriptFirstArg = typeof args[0] === 'string';

        args[0] = isScriptFirstArg ? processScript(args[0], false) : null;

        return args;
    }

    _callDeferredFunction (fn, args) {
        if (this.timeouts.length) {
            const curTimeouts = [];
            const curHandlers = [];

            for (let i = 0; i < this.timeouts.length; i++) {
                curTimeouts.push(this.timeouts[i]);
                curHandlers.push(this.deferredFunctions[i]);
            }

            this.timeouts          = [];
            this.deferredFunctions = [];

            for (let j = 0; j < curTimeouts.length; j++) {
                nativeMethods.clearInterval.call(this.window, curTimeouts[j]);
                curHandlers[j]();
            }

            // NOTE: Handlers can create new deferred functions.
            return this._callDeferredFunction(fn, args);
        }

        return fn.apply(this.window, args);
    }

    attach (window) {
        super.attach(window);

        const timersSandbox = this;

        overrideFunction(window, 'setTimeout', function (...args) {
            return nativeMethods.setTimeout.apply(window, timersSandbox._wrapTimeoutFunctionsArguments(args));
        });

        overrideFunction(window, 'setInterval', function (...args) {
            return nativeMethods.setInterval.apply(window, timersSandbox._wrapTimeoutFunctionsArguments(args));
        });

        // NOTE: We are saving the setTimeout wrapper for internal use in case the page-script replaces
        // it with an invalid value.
        this.setTimeout = window.setTimeout;
    }

    deferFunction (fn) {
        const deferredFunction = () => {
            fn();

            for (let i = 0; i < this.deferredFunctions.length; i++) {
                if (this.deferredFunctions[i] === deferredFunction) {
                    this.deferredFunctions.splice(i, 1);
                    this.timeouts.splice(i, 1);

                    break;
                }
            }
        };

        this.deferredFunctions.push(deferredFunction);
        this.timeouts.push(nativeMethods.setTimeout.call(window, deferredFunction, 0));
    }
}

