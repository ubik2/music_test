const State = {
    Stopped: 0,
    Started: 1,
    Paused: 2
};

export class ScheduleEntry {
    /**
     * Callback for doing the scheduled work
     *
     * @callback scheduleCallback
     * @param {Number} time - the time in seconds after the schedule is started that the callback is invoked.
     */

     /**
     * Create a new ScheduleEntry instance which holds the time and a function
     * 
     * @param {Number} time - the time in seconds after the schedule is started when the entry should be run.
     * @param {scheduleCallback} func - the callback function that will be invoked at the specified time.
     */
    constructor(time, func) {
        this.time = time;
        this.func = func;
    }
}

export class Schedule {
    /**
     * Create a new Schedule instance which can be used to schedule events
     * 
     * @param {Clock} - clock instance which will be used to track time
     */
    constructor(clock) {
        this.clock = clock;
        this.entries = [];
        this.startOffset = 0;
        this.active = false;
        this.run = this.run.bind(this);
        if (this.clock != null) {
            this.clock.addListener(this.run);
        }
    }

    dispose() {
        this.stop();
        this.clock.removeListener(this.run);
    }

    /**
     * Add a schedule entry at the specified time for the specified callback function.
     * 
     * @param {Number} time - the time in seconds after the schedule is started when the entry should be run.
     * @param {scheduleCallback} func - the callback function that will be invoked at the specified time.
     */
    add(time, func) {
        const entry = new ScheduleEntry(time, func);
        for (let i = 0; i < this.entries.length; i++) {
            if (time < this.entries[i].time) {
                this.entries.splice(i, 0, entry);
                return entry;
            }            
        }
        this.entries.push(entry);
        return entry;
    }

    addRelative(time, func) {
        return this.add(this.timeSinceStart/1000 + time, func)
    }

    /**
     * Start the schedule
     */
    start() {
        this.startOffset = this.clock.elapsed;
        this.active = true;
    }

    /**
     * Stop the schedule
     */
    stop() {
        this.active = false;
    }

    /**
     * Stops the schedule and clears all entries
     */
    cancel() {
        this.entries = [];
        this.startOffset = 0;
        this.active = false;
    }
    
    /**
     * Run any schedule entries that are due
     * 
     * @param {Number} ticks - the number of ticks that have elapsed since the last invocation by the clock
     * @param {Clock} clock - the clock instance
     */
    run(ticks, clock) {
        if (!this.active) {
            return;
        }
        let lastEntryIndex = -1;
        const ticksFromStart = clock.elapsed - this.startOffset;
        for (let i = 0; i < this.entries.length; i++) {
            const entry = this.entries[i];
            if (entry.time * 1000 <= ticksFromStart) {
                entry.func(ticksFromStart / 1000);
                lastEntryIndex = i;
            }
        }
        if (lastEntryIndex >= 0) {
            this.entries.splice(0, lastEntryIndex + 1);
        }
    }

    get timeSinceStart() {
        return this.clock.elapsed - this.startOffset;
    }
}

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
            clockSingleton = new Clock();
            clockSingleton.start();
        }
        return clockSingleton;
    }
}