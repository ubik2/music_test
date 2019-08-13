const State = {
    Stopped: 0,
    Started: 1,
    Paused: 2
};

let clockSingleton = null;
export class Clock {
    /**
     * Create a new Clock instance which can be used to emit tick events
     * 
     * @param {Number} [tickTime=10] number of milliseconds between tick events
     */
    constructor(tickTime) {
        this.tickTime = tickTime || 10;
        this.elapsed = 0;
        this.state = State.Stopped;
        this.onTickHandlers = [];
        this.start();
    }

    dispose() {
        this.stop();
        this.removeAllListeners();
    }

    start() {
        this.elapsed = 0;
        this.state = State.Started;
        if (this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.interval = setInterval(() => this.onTick(this.tickTime), this.tickTime);
    }

    stop() {
        this.state = State.Stopped;
        if (this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    pause() {
        this.state = State.Paused;
        if (this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    resume() {
        this.state = State.Started;
        if (this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.interval = setInterval(() => this.onTick(this.tickTime), this.tickTime);
    }

    onTick(ticks) {
        if (this.state === State.Started) {
            this.elapsed += ticks;
            this.onTickHandlers.forEach((fn) => fn(ticks, this));
        }
    }

    /**
    * Callback for handling a tick event
    *
    * @callback tickCallback
    * @param {Number} ticks - the number of milliseconds that have elapsed since the last tick
    * @param {Clock} clock - the clock object that emitted the tick event
    */

    /**
     * Adds a callback which will be triggered when our timer ticks
     *
     * @param {tickCallback} callback function that will be set as the clock's tick handler
     */
    addListener(callback) {
        this.onTickHandlers.push(callback);
    }

    /**
     * Removes a callback which will no longer be triggered when our timer ticks
     *
     * @param {tickCallback} callback function that will be removed from the clock's tick handler
     */
    removeListener(callback) {
        const index = this.onTickHandlers.indexOf(callback);
        if (index >= 0) {
            // Make a copy and update that, so that if we are in the middle of walking through our handlers, we'll hit that full list.
            // This means that we may still call a removed listener for this event, but will not call it for the next event.
            const updatedHandlers = this.onTickHandlers.slice(0);
            updatedHandlers.splice(index, 1);
            this.onTickHandlers = updatedHandlers;
        }
    }

    /**
     * Remove all registered event listeners
     */
    removeAllListeners() {
        this.onTickHandlers = [];
    }

    /**
     * Gets a shared instance of the Clock handler with the default tick timer (10 ms).
     * 
     * @return {Clock} the shared clock instance
     */
    static instance() {
        if (clockSingleton === null) {
            clockSingleton = new Clock(10);
        }
        return Clock._instance;
    }
};