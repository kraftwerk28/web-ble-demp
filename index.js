(function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    /* src/Warning.svelte generated by Svelte v3.23.2 */

    function create_fragment(ctx) {
    	let h4;
    	let t3;
    	let h5;

    	return {
    		c() {
    			h4 = element("h4");

    			h4.innerHTML = `
  Warning! Check if your browser
  <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API">
    supports BLE API
  </a>
  .
`;

    			t3 = space();
    			h5 = element("h5");

    			h5.innerHTML = `
  Also, check these links:
  <a href="https://www.bluetooth.com/specifications/gatt/services/" target="_blank">
    GATT services
  </a>
  and
  <a href="https://www.bluetooth.com/specifications/gatt/characteristics/" target="_blank">
    GATT characteristics
  </a>
  to match characteristics with selected service.
`;
    		},
    		m(target, anchor) {
    			insert(target, h4, anchor);
    			insert(target, t3, anchor);
    			insert(target, h5, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h4);
    			if (detaching) detach(t3);
    			if (detaching) detach(h5);
    		}
    	};
    }

    class Warning extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment, safe_not_equal, {});
    	}
    }

    const genuuid = (function*() {
      let c = 0;
      while (true) {
        yield c++;
      }
    })();

    const textDecoder = new TextDecoder('utf-8');

    function uuid() {
      return genuuid.next().value;
    }

    function decodeDataView(dv) {
      const arr = [];
      for (let i = 0; i < dv.byteLength; i++) {
        arr.push(dv.getUint8(i));
      }
      return arr;
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function slide(node, { delay = 0, duration = 400, easing = cubicOut }) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => `overflow: hidden;` +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }

    /* src/MessageLog.svelte generated by Svelte v3.23.2 */

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-1hiloqm-style";
    	style.textContent = ".message-log.svelte-1hiloqm.svelte-1hiloqm{margin:auto;width:55%}@media screen and (max-width: 920px){.message-log.svelte-1hiloqm.svelte-1hiloqm{margin:auto;width:unset}}.message-log.svelte-1hiloqm ol.svelte-1hiloqm{padding:0}.message-log.svelte-1hiloqm li.svelte-1hiloqm{display:block;border-radius:4px;padding:5px;margin:2px;border:1px solid rgba(0 0 0 / 0.4);cursor:pointer;text-align:left}.message-log.svelte-1hiloqm .message-info.svelte-1hiloqm{background:rgba(0 0 255 / 0.2)}.message-log.svelte-1hiloqm .message-error.svelte-1hiloqm{background:rgba(255 0 0 / 0.2)}.message-log.svelte-1hiloqm .message-warn.svelte-1hiloqm{background:rgba(255 255 0 / 0.2)}";
    	append(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	child_ctx[4] = i;
    	return child_ctx;
    }

    // (77:4) {#each $msgLog as msg, i (msg.id)}
    function create_each_block(key_1, ctx) {
    	let li;
    	let t0_value = /*msg*/ ctx[2].id + "";
    	let t0;
    	let t1_value = ". " + "";
    	let t1;
    	let t2_value = /*msg*/ ctx[2].text + "";
    	let t2;
    	let t3;
    	let li_class_value;
    	let li_transition;
    	let current;
    	let mounted;
    	let dispose;

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = text(t1_value);
    			t2 = text(t2_value);
    			t3 = space();
    			attr(li, "class", li_class_value = "" + (null_to_empty(`message-${/*msg*/ ctx[2].type}`) + " svelte-1hiloqm"));
    			this.first = li;
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    			append(li, t3);
    			current = true;

    			if (!mounted) {
    				dispose = listen(li, "click", function () {
    					if (is_function(removeAt(/*i*/ ctx[4]))) removeAt(/*i*/ ctx[4]).apply(this, arguments);
    				});

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*$msgLog*/ 1) && t0_value !== (t0_value = /*msg*/ ctx[2].id + "")) set_data(t0, t0_value);
    			if ((!current || dirty & /*$msgLog*/ 1) && t2_value !== (t2_value = /*msg*/ ctx[2].text + "")) set_data(t2, t2_value);

    			if (!current || dirty & /*$msgLog*/ 1 && li_class_value !== (li_class_value = "" + (null_to_empty(`message-${/*msg*/ ctx[2].type}`) + " svelte-1hiloqm"))) {
    				attr(li, "class", li_class_value);
    			}
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!li_transition) li_transition = create_bidirectional_transition(li, slide, { duration: 200 }, true);
    				li_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!li_transition) li_transition = create_bidirectional_transition(li, slide, { duration: 200 }, false);
    			li_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (detaching && li_transition) li_transition.end();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let div;
    	let h3;
    	let button;
    	let t1;
    	let t2;
    	let ol;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*$msgLog*/ ctx[0];
    	const get_key = ctx => /*msg*/ ctx[2].id;

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	return {
    		c() {
    			div = element("div");
    			h3 = element("h3");
    			button = element("button");
    			button.textContent = "❌";
    			t1 = text("\n    Message log:");
    			t2 = space();
    			ol = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(ol, "class", "svelte-1hiloqm");
    			attr(div, "class", "message-log svelte-1hiloqm");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h3);
    			append(h3, button);
    			append(h3, t1);
    			append(div, t2);
    			append(div, ol);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler*/ ctx[1]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$msgLog, removeAt*/ 1) {
    				const each_value = /*$msgLog*/ ctx[0];
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, ol, outro_and_destroy_block, create_each_block, null, get_each_context);
    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			dispose();
    		}
    	};
    }

    let msgLog = writable([]);

    function log(payload, type = "info") {
    	let e;

    	if (payload instanceof Error) {
    		let text = "";
    		if (payload.type) text += payload.text + ": ";
    		text += payload.message;
    		e = { text, type: "error", id: uuid() };
    	} else {
    		e = { text: payload, type, id: uuid() };
    	}

    	msgLog.update(m => [...m, e]);
    }

    function removeAt(index) {
    	return () => {
    		msgLog.update(m => {
    			m.splice(index, 1);
    			return [...m];
    		});
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let $msgLog;
    	component_subscribe($$self, msgLog, $$value => $$invalidate(0, $msgLog = $$value));
    	const click_handler = () => msgLog.set([]);
    	return [$msgLog, click_handler];
    }

    class MessageLog extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-1hiloqm-style")) add_css();
    		init(this, options, instance, create_fragment$1, safe_not_equal, {});
    	}
    }

    const ALL_SERVICES = [
      {
        name: 'generic_access',
        readableName: 'Generic Access',
        uuid: 0x1800,
      },
      {
        name: 'alert_notification',
        readableName: 'Alert Notification Service',
        uuid: 0x1811,
      },
      {
        name: 'automation_io',
        readableName: 'Automation IO',
        uuid: 0x1815,
      },
      {
        name: 'battery_service',
        readableName: 'Battery Service',
        uuid: 0x180f,
      },
      {
        name: 'blood_pressure',
        readableName: 'Blood Pressure',
        uuid: 0x1810,
      },
      {
        name: 'body_composition',
        readableName: 'Body Composition',
        uuid: 0x181b,
      },
      {
        name: 'bond_management',
        readableName: 'Bond Management Service',
        uuid: 0x181e,
      },
      {
        name: 'continuous_glucose_monitoring',
        readableName: 'Continuous Glucose Monitoring',
        uuid: 0x181f,
      },
      {
        name: 'current_time',
        readableName: 'Current Time Service',
        uuid: 0x1805,
      },
      {
        name: 'cycling_power',
        readableName: 'Cycling Power',
        uuid: 0x1818,
      },
      {
        name: 'cycling_speed_and_cadence',
        readableName: 'Cycling Speed and Cadence',
        uuid: 0x1816,
      },
      {
        name: 'device_information',
        readableName: 'Device Information',
        uuid: 0x180a,
      },
      {
        name: 'environmental_sensing',
        readableName: 'Environmental Sensing',
        uuid: 0x181a,
      },
      {
        name: 'fitness_machine',
        readableName: 'Fitness Machine',
        uuid: 0x1826,
      },
      {
        name: 'generic_attribute',
        readableName: 'Generic Attribute',
        uuid: 0x1801,
      },
      {
        name: 'glucose',
        readableName: 'Glucose',
        uuid: 0x1808,
      },
      {
        name: 'health_thermometer',
        readableName: 'Health Thermometer',
        uuid: 0x1809,
      },
      {
        name: 'heart_rate',
        readableName: 'Heart Rate',
        uuid: 0x180d,
      },
      {
        name: 'http_proxy',
        readableName: 'HTTP Proxy',
        uuid: 0x1823,
      },
      {
        name: 'human_interface_device',
        readableName: 'Human Interface Device',
        uuid: 0x1812,
      },
      {
        name: 'immediate_alert',
        readableName: 'Immediate Alert',
        uuid: 0x1802,
      },
      {
        name: 'indoor_positioning',
        readableName: 'Indoor Positioning',
        uuid: 0x1821,
      },
      {
        name: 'insulin_delivery',
        readableName: 'Insulin Delivery',
        uuid: 0x183a,
      },
      {
        name: 'internet_protocol_support',
        readableName: 'Internet Protocol Support Service',
        uuid: 0x1820,
      },
      {
        name: 'link_loss',
        readableName: 'Link Loss',
        uuid: 0x1803,
      },
      {
        name: 'location_and_navigation',
        readableName: 'Location and Navigation',
        uuid: 0x1819,
      },
      {
        name: 'mesh_provisioning',
        readableName: 'Mesh Provisioning Service',
        uuid: 0x1827,
      },
      {
        name: 'mesh_proxy',
        readableName: 'Mesh Proxy Service',
        uuid: 0x1828,
      },
      {
        name: 'next_dst_change',
        readableName: 'Next DST Change Service',
        uuid: 0x1807,
      },
      {
        name: 'object_transfer',
        readableName: 'Object Transfer Service',
        uuid: 0x1825,
      },
      {
        name: 'phone_alert_status',
        readableName: 'Phone Alert Status Service',
        uuid: 0x180e,
      },
      {
        name: 'pulse_oximeter',
        readableName: 'Pulse Oximeter Service',
        uuid: 0x1822,
      },
      {
        name: 'reconnection_configuration',
        readableName: 'Reconnection Configuration',
        uuid: 0x1829,
      },
      {
        name: 'reference_time_update',
        readableName: 'Reference Time Update Service',
        uuid: 0x1806,
      },
      {
        name: 'running_speed_and_cadence',
        readableName: 'Running Speed and Cadence',
        uuid: 0x1814,
      },
      {
        name: 'scan_parameters',
        readableName: 'Scan Parameters',
        uuid: 0x1813,
      },
      {
        name: 'transport_discovery',
        readableName: 'Transport Discovery',
        uuid: 0x1824,
      },
      {
        name: 'tx_power',
        readableName: 'Tx Power',
        uuid: 0x1804,
      },
      {
        name: 'user_data',
        readableName: 'User Data',
        uuid: 0x181c,
      },
      {
        name: 'weight_scale',
        readableName: 'Weight Scale',
        uuid: 0x181d,
      },
    ];

    const CHARACTERISTICS = [
      {
        name: 'aerobic_heart_rate_lower_limit',
        readableName: 'Aerobic Heart Rate Lower Limit',
        uuid: 0x2a7e,
      },
      {
        name: 'aerobic_heart_rate_upper_limit',
        readableName: 'Aerobic Heart Rate Upper Limit',
        uuid: 0x2a84,
      },
      {
        name: 'aerobic_threshold',
        readableName: 'Aerobic Threshold',
        uuid: 0x2a7f,
      },
      {
        name: 'age',
        readableName: 'Age',
        uuid: 0x2a80,
      },
      {
        name: 'aggregate',
        readableName: 'Aggregate',
        uuid: 0x2a5a,
      },
      {
        name: 'alert_category_id',
        readableName: 'Alert Category ID',
        uuid: 0x2a43,
      },
      {
        name: 'alert_category_id_bit_mask',
        readableName: 'Alert Category ID Bit Mask',
        uuid: 0x2a42,
      },
      {
        name: 'alert_level',
        readableName: 'Alert Level',
        uuid: 0x2a06,
      },
      {
        name: 'alert_notification_control_point',
        readableName: 'Alert Notification Control Point',
        uuid: 0x2a44,
      },
      {
        name: 'alert_status',
        readableName: 'Alert Status',
        uuid: 0x2a3f,
      },
      {
        name: 'altitude',
        readableName: 'Altitude',
        uuid: 0x2ab3,
      },
      {
        name: 'anaerobic_heart_rate_lower_limit',
        readableName: 'Anaerobic Heart Rate Lower Limit',
        uuid: 0x2a81,
      },
      {
        name: 'anaerobic_heart_rate_upper_limit',
        readableName: 'Anaerobic Heart Rate Upper Limit',
        uuid: 0x2a82,
      },
      {
        name: 'anaerobic_threshold',
        readableName: 'Anaerobic Threshold',
        uuid: 0x2a83,
      },
      {
        name: 'analog',
        readableName: 'Analog',
        uuid: 0x2a58,
      },
      {
        name: 'analog_output',
        readableName: 'Analog Output',
        uuid: 0x2a59,
      },
      {
        name: 'apparent_wind_direction',
        readableName: 'Apparent Wind Direction',
        uuid: 0x2a73,
      },
      {
        name: 'apparent_wind_speed',
        readableName: 'Apparent Wind Speed',
        uuid: 0x2a72,
      },
      {
        name: 'appearance',
        readableName: 'Appearance',
        uuid: 0x2a01,
      },
      {
        name: 'barometric_pressure_trend',
        readableName: 'Barometric Pressure Trend',
        uuid: 0x2aa3,
      },
      {
        name: 'battery_level',
        readableName: 'Battery Level',
        uuid: 0x2a19,
      },
      {
        name: 'battery_level_state',
        readableName: 'Battery Level State',
        uuid: 0x2a1b,
      },
      {
        name: 'battery_power_state',
        readableName: 'Battery Power State',
        uuid: 0x2a1a,
      },
      {
        name: 'blood_pressure_feature',
        readableName: 'Blood Pressure Feature',
        uuid: 0x2a49,
      },
      {
        name: 'blood_pressure_measurement',
        readableName: 'Blood Pressure Measurement',
        uuid: 0x2a35,
      },
      {
        name: 'body_composition_feature',
        readableName: 'Body Composition Feature',
        uuid: 0x2a9b,
      },
      {
        name: 'body_composition_measurement',
        readableName: 'Body Composition Measurement',
        uuid: 0x2a9c,
      },
      {
        name: 'body_sensor_location',
        readableName: 'Body Sensor Location',
        uuid: 0x2a38,
      },
      {
        name: 'bond_management_control_point',
        readableName: 'Bond Management Control Point',
        uuid: 0x2aa4,
      },
      {
        name: 'bond_management_feature',
        readableName: 'Bond Management Features',
        uuid: 0x2aa5,
      },
      {
        name: 'boot_keyboard_input_report',
        readableName: 'Boot Keyboard Input Report',
        uuid: 0x2a22,
      },
      {
        name: 'boot_keyboard_output_report',
        readableName: 'Boot Keyboard Output Report',
        uuid: 0x2a32,
      },
      {
        name: 'boot_mouse_input_report',
        readableName: 'Boot Mouse Input Report',
        uuid: 0x2a33,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'BSS Control Point',
        uuid: 0x2b2b,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'BSS Response',
        uuid: 0x2b2c,
      },
      {
        name: 'cgm_feature',
        readableName: 'CGM Feature',
        uuid: 0x2aa8,
      },
      {
        name: 'cgm_measurement',
        readableName: 'CGM Measurement',
        uuid: 0x2aa7,
      },
      {
        name: 'cgm_session_run_time',
        readableName: 'CGM Session Run Time',
        uuid: 0x2aab,
      },
      {
        name: 'cgm_session_start_time',
        readableName: 'CGM Session Start Time',
        uuid: 0x2aaa,
      },
      {
        name: 'cgm_specific_ops_control_point',
        readableName: 'CGM Specific Ops Control Point',
        uuid: 0x2aac,
      },
      {
        name: 'cgm_status',
        readableName: 'CGM Status',
        uuid: 0x2aa9,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'Client Supported Features',
        uuid: 0x2b29,
      },
      {
        name: 'cross_trainer_data',
        readableName: 'Cross Trainer Data',
        uuid: 0x2ace,
      },
      {
        name: 'csc_feature',
        readableName: 'CSC Feature',
        uuid: 0x2a5c,
      },
      {
        name: 'csc_measurement',
        readableName: 'CSC Measurement',
        uuid: 0x2a5b,
      },
      {
        name: 'current_time',
        readableName: 'Current Time',
        uuid: 0x2a2b,
      },
      {
        name: 'cycling_power_control_point',
        readableName: 'Cycling Power Control Point',
        uuid: 0x2a66,
      },
      {
        name: 'cycling_power_feature',
        readableName: 'Cycling Power Feature',
        uuid: 0x2a65,
      },
      {
        name: 'cycling_power_measurement',
        readableName: 'Cycling Power Measurement',
        uuid: 0x2a63,
      },
      {
        name: 'cycling_power_vector',
        readableName: 'Cycling Power Vector',
        uuid: 0x2a64,
      },
      {
        name: 'database_change_increment',
        readableName: 'Database Change Increment',
        uuid: 0x2a99,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'Database Hash',
        uuid: 0x2b2a,
      },
      {
        name: 'date_of_birth',
        readableName: 'Date of Birth',
        uuid: 0x2a85,
      },
      {
        name: 'date_of_threshold_assessment',
        readableName: 'Date of Threshold Assessment',
        uuid: 0x2a86,
      },
      {
        name: 'date_time',
        readableName: 'Date Time',
        uuid: 0x2a08,
      },
      {
        name: 'date_utc',
        readableName: 'Date UTC',
        uuid: 0x2aed,
      },
      {
        name: 'day_date_time',
        readableName: 'Day Date Time',
        uuid: 0x2a0a,
      },
      {
        name: 'day_of_week',
        readableName: 'Day of Week',
        uuid: 0x2a09,
      },
      {
        name: 'descriptor_value_changed',
        readableName: 'Descriptor Value Changed',
        uuid: 0x2a7d,
      },
      {
        name: 'dew_point',
        readableName: 'Dew Point',
        uuid: 0x2a7b,
      },
      {
        name: 'digital',
        readableName: 'Digital',
        uuid: 0x2a56,
      },
      {
        name: 'digital_output',
        readableName: 'Digital Output',
        uuid: 0x2a57,
      },
      {
        name: 'dst_offset',
        readableName: 'DST Offset',
        uuid: 0x2a0d,
      },
      {
        name: 'elevation',
        readableName: 'Elevation',
        uuid: 0x2a6c,
      },
      {
        name: 'email_address',
        readableName: 'Email Address',
        uuid: 0x2a87,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'Emergency ID',
        uuid: 0x2b2d,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'Emergency Text',
        uuid: 0x2b2e,
      },
      {
        name: 'exact_time_100',
        readableName: 'Exact Time 100',
        uuid: 0x2a0b,
      },
      {
        name: 'exact_time_256',
        readableName: 'Exact Time 256',
        uuid: 0x2a0c,
      },
      {
        name: 'fat_burn_heart_rate_lower_limit',
        readableName: 'Fat Burn Heart Rate Lower Limit',
        uuid: 0x2a88,
      },
      {
        name: 'fat_burn_heart_rate_upper_limit',
        readableName: 'Fat Burn Heart Rate Upper Limit',
        uuid: 0x2a89,
      },
      {
        name: 'firmware_revision_string',
        readableName: 'Firmware Revision String',
        uuid: 0x2a26,
      },
      {
        name: 'first_name',
        readableName: 'First Name',
        uuid: 0x2a8a,
      },
      {
        name: 'fitness_machine_control_point',
        readableName: 'Fitness Machine Control Point',
        uuid: 0x2ad9,
      },
      {
        name: 'fitness_machine_feature',
        readableName: 'Fitness Machine Feature',
        uuid: 0x2acc,
      },
      {
        name: 'fitness_machine_status',
        readableName: 'Fitness Machine Status',
        uuid: 0x2ada,
      },
      {
        name: 'five_zone_heart_rate_limits',
        readableName: 'Five Zone Heart Rate Limits',
        uuid: 0x2a8b,
      },
      {
        name: 'floor_number',
        readableName: 'Floor Number',
        uuid: 0x2ab2,
      },
      {
        name: 'central_address_resolution',
        readableName: 'Central Address Resolution',
        uuid: 0x2aa6,
      },
      {
        name: 'device_name',
        readableName: 'Device Name',
        uuid: 0x2a00,
      },
      {
        name: 'peripheral_preferred_connection_parameters',
        readableName: 'Peripheral Preferred Connection Parameters',
        uuid: 0x2a04,
      },
      {
        name: 'peripheral_privacy_flag',
        readableName: 'Peripheral Privacy Flag',
        uuid: 0x2a02,
      },
      {
        name: 'reconnection_address',
        readableName: 'Reconnection Address',
        uuid: 0x2a03,
      },
      {
        name: 'service_changed',
        readableName: 'Service Changed',
        uuid: 0x2a05,
      },
      {
        name: 'gender',
        readableName: 'Gender',
        uuid: 0x2a8c,
      },
      {
        name: 'glucose_feature',
        readableName: 'Glucose Feature',
        uuid: 0x2a51,
      },
      {
        name: 'glucose_measurement',
        readableName: 'Glucose Measurement',
        uuid: 0x2a18,
      },
      {
        name: 'glucose_measurement_context',
        readableName: 'Glucose Measurement Context',
        uuid: 0x2a34,
      },
      {
        name: 'gust_factor',
        readableName: 'Gust Factor',
        uuid: 0x2a74,
      },
      {
        name: 'hardware_revision_string',
        readableName: 'Hardware Revision String',
        uuid: 0x2a27,
      },
      {
        name: 'heart_rate_control_point',
        readableName: 'Heart Rate Control Point',
        uuid: 0x2a39,
      },
      {
        name: 'heart_rate_max',
        readableName: 'Heart Rate Max',
        uuid: 0x2a8d,
      },
      {
        name: 'heart_rate_measurement',
        readableName: 'Heart Rate Measurement',
        uuid: 0x2a37,
      },
      {
        name: 'heat_index',
        readableName: 'Heat Index',
        uuid: 0x2a7a,
      },
      {
        name: 'height',
        readableName: 'Height',
        uuid: 0x2a8e,
      },
      {
        name: 'hid_control_point',
        readableName: 'HID Control Point',
        uuid: 0x2a4c,
      },
      {
        name: 'hid_information',
        readableName: 'HID Information',
        uuid: 0x2a4a,
      },
      {
        name: 'hip_circumference',
        readableName: 'Hip Circumference',
        uuid: 0x2a8f,
      },
      {
        name: 'http_control_point',
        readableName: 'HTTP Control Point',
        uuid: 0x2aba,
      },
      {
        name: 'http_entity_body',
        readableName: 'HTTP Entity Body',
        uuid: 0x2ab9,
      },
      {
        name: 'http_headers',
        readableName: 'HTTP Headers',
        uuid: 0x2ab7,
      },
      {
        name: 'http_status_code',
        readableName: 'HTTP Status Code',
        uuid: 0x2ab8,
      },
      {
        name: 'https_security',
        readableName: 'HTTPS Security',
        uuid: 0x2abb,
      },
      {
        name: 'humidity',
        readableName: 'Humidity',
        uuid: 0x2a6f,
      },
      {
        name: 'idd_annunciation_status',
        readableName: 'IDD Annunciation Status',
        uuid: 0x2b22,
      },
      {
        name: 'idd_command_control_point',
        readableName: 'IDD Command Control Point',
        uuid: 0x2b25,
      },
      {
        name: 'idd_command_data',
        readableName: 'IDD Command Data',
        uuid: 0x2b26,
      },
      {
        name: 'idd_features',
        readableName: 'IDD Features',
        uuid: 0x2b23,
      },
      {
        name: 'idd_history_data',
        readableName: 'IDD History Data',
        uuid: 0x2b28,
      },
      {
        name: 'idd_record_access_control_point',
        readableName: 'IDD Record Access Control Point',
        uuid: 0x2b27,
      },
      {
        name: 'idd_status',
        readableName: 'IDD Status',
        uuid: 0x2b21,
      },
      {
        name: 'idd_status_changed',
        readableName: 'IDD Status Changed',
        uuid: 0x2b20,
      },
      {
        name: 'idd_status_reader_control_point',
        readableName: 'IDD Status Reader Control Point',
        uuid: 0x2b24,
      },
      {
        name: 'ieee_11073-20601_regulatory_certification_data_list',
        readableName: 'IEEE 11073-20601 Regulatory Certification Data List',
        uuid: 0x2a2a,
      },
      {
        name: 'indoor_bike_data',
        readableName: 'Indoor Bike Data',
        uuid: 0x2ad2,
      },
      {
        name: 'indoor_positioning_configuration',
        readableName: 'Indoor Positioning Configuration',
        uuid: 0x2aad,
      },
      {
        name: 'intermediate_cuff_pressure',
        readableName: 'Intermediate Cuff Pressure',
        uuid: 0x2a36,
      },
      {
        name: 'intermediate_temperature',
        readableName: 'Intermediate Temperature',
        uuid: 0x2a1e,
      },
      {
        name: 'irradiance',
        readableName: 'Irradiance',
        uuid: 0x2a77,
      },
      {
        name: 'language',
        readableName: 'Language',
        uuid: 0x2aa2,
      },
      {
        name: 'last_name',
        readableName: 'Last Name',
        uuid: 0x2a90,
      },
      {
        name: 'latitude',
        readableName: 'Latitude',
        uuid: 0x2aae,
      },
      {
        name: 'ln_control_point',
        readableName: 'LN Control Point',
        uuid: 0x2a6b,
      },
      {
        name: 'ln_feature',
        readableName: 'LN Feature',
        uuid: 0x2a6a,
      },
      {
        name: 'local_east_coordinate',
        readableName: 'Local East Coordinate',
        uuid: 0x2ab1,
      },
      {
        name: 'local_north_coordinate',
        readableName: 'Local North Coordinate',
        uuid: 0x2ab0,
      },
      {
        name: 'local_time_information',
        readableName: 'Local Time Information',
        uuid: 0x2a0f,
      },
      {
        name: 'location_and_speed',
        readableName: 'Location and Speed Characteristic',
        uuid: 0x2a67,
      },
      {
        name: 'location_name',
        readableName: 'Location Name',
        uuid: 0x2ab5,
      },
      {
        name: 'Longitude',
        readableName: 'Longitude',
        uuid: 0x2aaf,
      },
      {
        name: 'magnetic_declination',
        readableName: 'Magnetic Declination',
        uuid: 0x2a2c,
      },
      {
        name: 'Magnetic_flux_density_2D',
        readableName: 'Magnetic Flux Density – 2D',
        uuid: 0x2aa0,
      },
      {
        name: 'Magnetic_flux_density_3D',
        readableName: 'Magnetic Flux Density – 3D',
        uuid: 0x2aa1,
      },
      {
        name: 'manufacturer_name_string',
        readableName: 'Manufacturer Name String',
        uuid: 0x2a29,
      },
      {
        name: 'maximum_recommended_heart_rate',
        readableName: 'Maximum Recommended Heart Rate',
        uuid: 0x2a91,
      },
      {
        name: 'measurement_interval',
        readableName: 'Measurement Interval',
        uuid: 0x2a21,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'Mesh Provisioning Data In',
        uuid: 0x2adb,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'Mesh Provisioning Data Out',
        uuid: 0x2adc,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'Mesh Proxy Data In',
        uuid: 0x2add,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'Mesh Proxy Data Out',
        uuid: 0x2ade,
      },
      {
        name: 'model_number_string',
        readableName: 'Model Number String',
        uuid: 0x2a24,
      },
      {
        name: 'navigation',
        readableName: 'Navigation',
        uuid: 0x2a68,
      },
      {
        name: 'network_availability',
        readableName: 'Network Availability',
        uuid: 0x2a3e,
      },
      {
        name: 'new_alert',
        readableName: 'New Alert',
        uuid: 0x2a46,
      },
      {
        name: 'object_action_control_point',
        readableName: 'Object Action Control Point',
        uuid: 0x2ac5,
      },
      {
        name: 'object_changed',
        readableName: 'Object Changed',
        uuid: 0x2ac8,
      },
      {
        name: 'object_first_created',
        readableName: 'Object First-Created',
        uuid: 0x2ac1,
      },
      {
        name: 'object_id',
        readableName: 'Object ID',
        uuid: 0x2ac3,
      },
      {
        name: 'object_last_modified',
        readableName: 'Object Last-Modified',
        uuid: 0x2ac2,
      },
      {
        name: 'object_list_control_point',
        readableName: 'Object List Control Point',
        uuid: 0x2ac6,
      },
      {
        name: 'object_list_filter',
        readableName: 'Object List Filter',
        uuid: 0x2ac7,
      },
      {
        name: 'object_name',
        readableName: 'Object Name',
        uuid: 0x2abe,
      },
      {
        name: 'object_properties',
        readableName: 'Object Properties',
        uuid: 0x2ac4,
      },
      {
        name: 'object_size',
        readableName: 'Object Size',
        uuid: 0x2ac0,
      },
      {
        name: 'object_type',
        readableName: 'Object Type',
        uuid: 0x2abf,
      },
      {
        name: 'ots_feature',
        readableName: 'OTS Feature',
        uuid: 0x2abd,
      },
      {
        name: 'plx_continuous_measurement',
        readableName: 'PLX Continuous Measurement Characteristic',
        uuid: 0x2a5f,
      },
      {
        name: 'plx_features',
        readableName: 'PLX Features',
        uuid: 0x2a60,
      },
      {
        name: 'plx_spot_check_measurement',
        readableName: 'PLX Spot-Check Measurement',
        uuid: 0x2a5e,
      },
      {
        name: 'pnp_id',
        readableName: 'PnP ID',
        uuid: 0x2a50,
      },
      {
        name: 'pollen_concentration',
        readableName: 'Pollen Concentration',
        uuid: 0x2a75,
      },
      {
        name: 'position_2d',
        readableName: 'Position 2D',
        uuid: 0x2a2f,
      },
      {
        name: 'position_3d',
        readableName: 'Position 3D',
        uuid: 0x2a30,
      },
      {
        name: 'position_quality',
        readableName: 'Position Quality',
        uuid: 0x2a69,
      },
      {
        name: 'pressure',
        readableName: 'Pressure',
        uuid: 0x2a6d,
      },
      {
        name: 'protocol_mode',
        readableName: 'Protocol Mode',
        uuid: 0x2a4e,
      },
      {
        name: 'pulse_oximetry_control_point',
        readableName: 'Pulse Oximetry Control Point',
        uuid: 0x2a62,
      },
      {
        name: 'rainfall',
        readableName: 'Rainfall',
        uuid: 0x2a78,
      },
      {
        name: 'rc_feature',
        readableName: 'RC Feature',
        uuid: 0x2b1d,
      },
      {
        name: 'rc_settings',
        readableName: 'RC Settings',
        uuid: 0x2b1e,
      },
      {
        name: 'reconnection_configuration_control_point',
        readableName: 'Reconnection Configuration Control Point',
        uuid: 0x2b1f,
      },
      {
        name: 'record_access_control_point',
        readableName: 'Record Access Control Point',
        uuid: 0x2a52,
      },
      {
        name: 'reference_time_information',
        readableName: 'Reference Time Information',
        uuid: 0x2a14,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'Registered User Characteristic',
        uuid: 0x2b37,
      },
      {
        name: 'removable',
        readableName: 'Removable',
        uuid: 0x2a3a,
      },
      {
        name: 'report',
        readableName: 'Report',
        uuid: 0x2a4d,
      },
      {
        name: 'report_map',
        readableName: 'Report Map',
        uuid: 0x2a4b,
      },
      {
        name: 'resolvable_private_address_only',
        readableName: 'Resolvable Private Address Only',
        uuid: 0x2ac9,
      },
      {
        name: 'resting_heart_rate',
        readableName: 'Resting Heart Rate',
        uuid: 0x2a92,
      },
      {
        name: 'ringer_control_point',
        readableName: 'Ringer Control point',
        uuid: 0x2a40,
      },
      {
        name: 'ringer_setting',
        readableName: 'Ringer Setting',
        uuid: 0x2a41,
      },
      {
        name: 'rower_data',
        readableName: 'Rower Data',
        uuid: 0x2ad1,
      },
      {
        name: 'rsc_feature',
        readableName: 'RSC Feature',
        uuid: 0x2a54,
      },
      {
        name: 'rsc_measurement',
        readableName: 'RSC Measurement',
        uuid: 0x2a53,
      },
      {
        name: 'sc_control_point',
        readableName: 'SC Control Point',
        uuid: 0x2a55,
      },
      {
        name: 'scan_interval_window',
        readableName: 'Scan Interval Window',
        uuid: 0x2a4f,
      },
      {
        name: 'scan_refresh',
        readableName: 'Scan Refresh',
        uuid: 0x2a31,
      },
      {
        name: 'scientific_temperature_celsius',
        readableName: 'Scientific Temperature Celsius',
        uuid: 0x2a3c,
      },
      {
        name: 'secondary_time_zone',
        readableName: 'Secondary Time Zone',
        uuid: 0x2a10,
      },
      {
        name: 'sensor_location',
        readableName: 'Sensor Location',
        uuid: 0x2a5d,
      },
      {
        name: 'serial_number_string',
        readableName: 'Serial Number String',
        uuid: 0x2a25,
      },
      {
        name: 'GATT Characteristic UUID',
        readableName: 'Server Supported Features',
        uuid: 0x2b3a,
      },
      {
        name: 'service_required',
        readableName: 'Service Required',
        uuid: 0x2a3b,
      },
      {
        name: 'software_revision_string',
        readableName: 'Software Revision String',
        uuid: 0x2a28,
      },
      {
        name: 'sport_type_for_aerobic_and_anaerobic_thresholds',
        readableName: 'Sport Type for Aerobic and Anaerobic Thresholds',
        uuid: 0x2a93,
      },
      {
        name: 'stair_climber_data',
        readableName: 'Stair Climber Data',
        uuid: 0x2ad0,
      },
      {
        name: 'step_climber_data',
        readableName: 'Step Climber Data',
        uuid: 0x2acf,
      },
      {
        name: 'string',
        readableName: 'String',
        uuid: 0x2a3d,
      },
      {
        name: 'supported_heart_rate_range',
        readableName: 'Supported Heart Rate Range',
        uuid: 0x2ad7,
      },
      {
        name: 'supported_inclination_range',
        readableName: 'Supported Inclination Range',
        uuid: 0x2ad5,
      },
      {
        name: 'supported_new_alert_category',
        readableName: 'Supported New Alert Category',
        uuid: 0x2a47,
      },
      {
        name: 'supported_power_range',
        readableName: 'Supported Power Range',
        uuid: 0x2ad8,
      },
      {
        name: 'supported_resistance_level_range',
        readableName: 'Supported Resistance Level Range',
        uuid: 0x2ad6,
      },
      {
        name: 'supported_speed_range',
        readableName: 'Supported Speed Range',
        uuid: 0x2ad4,
      },
      {
        name: 'supported_unread_alert_category',
        readableName: 'Supported Unread Alert Category',
        uuid: 0x2a48,
      },
      {
        name: 'system_id',
        readableName: 'System ID',
        uuid: 0x2a23,
      },
      {
        name: 'tds_control_point',
        readableName: 'TDS Control Point',
        uuid: 0x2abc,
      },
      {
        name: 'temperature',
        readableName: 'Temperature',
        uuid: 0x2a6e,
      },
      {
        name: 'temperature_celsius',
        readableName: 'Temperature Celsius',
        uuid: 0x2a1f,
      },
      {
        name: 'temperature_fahrenheit',
        readableName: 'Temperature Fahrenheit',
        uuid: 0x2a20,
      },
      {
        name: 'temperature_measurement',
        readableName: 'Temperature Measurement',
        uuid: 0x2a1c,
      },
      {
        name: 'temperature_type',
        readableName: 'Temperature Type',
        uuid: 0x2a1d,
      },
      {
        name: 'three_zone_heart_rate_limits',
        readableName: 'Three Zone Heart Rate Limits',
        uuid: 0x2a94,
      },
      {
        name: 'time_accuracy',
        readableName: 'Time Accuracy',
        uuid: 0x2a12,
      },
      {
        name: 'time_broadcast',
        readableName: 'Time Broadcast',
        uuid: 0x2a15,
      },
      {
        name: 'time_source',
        readableName: 'Time Source',
        uuid: 0x2a13,
      },
      {
        name: 'time_update_control_point',
        readableName: 'Time Update Control Point',
        uuid: 0x2a16,
      },
      {
        name: 'time_update_state',
        readableName: 'Time Update State',
        uuid: 0x2a17,
      },
      {
        name: 'time_with_dst',
        readableName: 'Time with DST',
        uuid: 0x2a11,
      },
      {
        name: 'time_zone',
        readableName: 'Time Zone',
        uuid: 0x2a0e,
      },
      {
        name: 'training_status',
        readableName: 'Training Status',
        uuid: 0x2ad3,
      },
      {
        name: 'treadmill_data',
        readableName: 'Treadmill Data',
        uuid: 0x2acd,
      },
      {
        name: 'true_wind_direction',
        readableName: 'True Wind Direction',
        uuid: 0x2a71,
      },
      {
        name: 'true_wind_speed',
        readableName: 'True Wind Speed',
        uuid: 0x2a70,
      },
      {
        name: 'two_zone_heart_rate_limit',
        readableName: 'Two Zone Heart Rate Limit',
        uuid: 0x2a95,
      },
      {
        name: 'tx_power_level',
        readableName: 'Tx Power Level',
        uuid: 0x2a07,
      },
      {
        name: 'uncertainty',
        readableName: 'Uncertainty',
        uuid: 0x2ab4,
      },
      {
        name: 'unread_alert_status',
        readableName: 'Unread Alert Status',
        uuid: 0x2a45,
      },
      {
        name: 'uri',
        readableName: 'URI',
        uuid: 0x2ab6,
      },
      {
        name: 'user_control_point',
        readableName: 'User Control Point',
        uuid: 0x2a9f,
      },
      {
        name: 'user_index',
        readableName: 'User Index',
        uuid: 0x2a9a,
      },
      {
        name: 'uv_index',
        readableName: 'UV Index',
        uuid: 0x2a76,
      },
      {
        name: 'vo2_max',
        readableName: 'VO2 Max',
        uuid: 0x2a96,
      },
      {
        name: 'waist_circumference',
        readableName: 'Waist Circumference',
        uuid: 0x2a97,
      },
      {
        name: 'weight',
        readableName: 'Weight',
        uuid: 0x2a98,
      },
      {
        name: 'weight_measurement',
        readableName: 'Weight Measurement',
        uuid: 0x2a9d,
      },
      {
        name: 'weight_scale_feature',
        readableName: 'Weight Scale Feature',
        uuid: 0x2a9e,
      },
      {
        name: 'wind_chill',
        readableName: 'Wind Chill',
        uuid: 0x2a79,
      },
    ];

    /* src/Characteristic.svelte generated by Svelte v3.23.2 */

    function create_if_block(ctx) {
    	let form0;
    	let button0;
    	let t1;
    	let input;
    	let input_value_value;
    	let t2;
    	let form1;
    	let button1;

    	let t3_value = (!/*isNotifying*/ ctx[1]
    	? "Start notify"
    	: "Stop notifications") + "";

    	let t3;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			form0 = element("form");
    			button0 = element("button");
    			button0.textContent = "Read value";
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			form1 = element("form");
    			button1 = element("button");
    			t3 = text(t3_value);
    			attr(button0, "type", "submit");
    			attr(input, "type", "text");
    			input.value = input_value_value = /*readResult*/ ctx[2] || "";
    			input.readOnly = true;
    			attr(button1, "type", "submit");
    		},
    		m(target, anchor) {
    			insert(target, form0, anchor);
    			append(form0, button0);
    			append(form0, t1);
    			append(form0, input);
    			insert(target, t2, anchor);
    			insert(target, form1, anchor);
    			append(form1, button1);
    			append(button1, t3);

    			if (!mounted) {
    				dispose = [
    					listen(form0, "submit", prevent_default(/*onReadValue*/ ctx[3])),
    					listen(form1, "submit", prevent_default(/*onToggleNotify*/ ctx[4]))
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*isNotifying*/ 2 && t3_value !== (t3_value = (!/*isNotifying*/ ctx[1]
    			? "Start notify"
    			: "Stop notifications") + "")) set_data(t3, t3_value);
    		},
    		d(detaching) {
    			if (detaching) detach(form0);
    			if (detaching) detach(t2);
    			if (detaching) detach(form1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let h3;
    	let t1;
    	let if_block_anchor;
    	let if_block = /*ch*/ ctx[0] && create_if_block(ctx);

    	return {
    		c() {
    			h3 = element("h3");
    			h3.textContent = "Current characteristic:";
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			insert(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, [dirty]) {
    			if (/*ch*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h3);
    			if (detaching) detach(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { ch } = $$props;
    	let readResult;
    	let isNotifying = false;

    	function onReadValue() {
    		ch.readValue().then(readResult => {
    			Object.assign(window, { readResult });
    			log(decodeDataView(readResult));
    		}).catch(log);
    	}

    	async function onToggleNotify() {
    		if (isNotifying) {
    			ch.removeEventListener("characteristicvaluechanged", onChValueChaged);
    			ch.stopNotifications().then(() => $$invalidate(1, isNotifying = false));
    		} else {
    			ch.addEventListener("characteristicvaluechanged", onChValueChaged);
    			ch.startNotifications().then(() => $$invalidate(1, isNotifying = true));
    		}
    	}

    	function onChValueChaged(e) {
    		log(decodeDataView(e.target.value));
    	}

    	onDestroy(() => {
    		ch.removeEventListener("characteristicvaluechanged", onChValueChaged);
    	});

    	$$self.$set = $$props => {
    		if ("ch" in $$props) $$invalidate(0, ch = $$props.ch);
    	};

    	return [ch, isNotifying, readResult, onReadValue, onToggleNotify];
    }

    class Characteristic extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, { ch: 0 });
    	}
    }

    /* src/Footer.svelte generated by Svelte v3.23.2 */

    const { window: window_1 } = globals;

    function add_css$1() {
    	var style = element("style");
    	style.id = "svelte-k7z2ju-style";
    	style.textContent = ".footer.svelte-k7z2ju{background:#fff;position:fixed;bottom:0px;border-top:1px solid #000;padding:10px;left:0;right:0}";
    	append(document.head, style);
    }

    // (26:0) {#if fvisible}
    function create_if_block$1(ctx) {
    	let div;
    	let div_transition;
    	let current;

    	return {
    		c() {
    			div = element("div");

    			div.innerHTML = `
    Made by
    <a href="https://kraftwerk28.pp.ua" target="_blank">@kraftwerk28</a>`;

    			attr(div, "class", "footer svelte-k7z2ju");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*fvisible*/ ctx[0] && create_if_block$1();

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen(window_1, "scroll", /*onScroll*/ ctx[1]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (/*fvisible*/ ctx[0]) {
    				if (if_block) {
    					if (dirty & /*fvisible*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1();
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let fvisible = true;

    	function onScroll() {
    		if (window.scrollY > 10 && fvisible) {
    			$$invalidate(0, fvisible = false);
    		} else if (window.scrollY <= 10 && !fvisible) {
    			$$invalidate(0, fvisible = true);
    		}
    	}

    	return [fvisible, onScroll];
    }

    class Footer extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-k7z2ju-style")) add_css$1();
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.2 */

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-1wuktin-style";
    	style.textContent = ".connected.svelte-1wuktin.svelte-1wuktin{color:rgb(0 185 0)}.connecting.svelte-1wuktin.svelte-1wuktin{color:rgb(150 0 255)}.failed.svelte-1wuktin.svelte-1wuktin{color:#f00}.double-side.svelte-1wuktin.svelte-1wuktin{display:flex;flex-flow:row wrap}.double-side.svelte-1wuktin>div.svelte-1wuktin:nth-child(1){border-right:1px solid #000;border-bottom:none}@media screen and (max-width: 800px){.double-side.svelte-1wuktin>div.svelte-1wuktin:nth-child(1){border-right:none;border-bottom:1px solid #000}}.double-side.svelte-1wuktin>div.svelte-1wuktin{flex:1 1 400px}";
    	append(document.head, style);
    }

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (144:55) {:else}
    function create_else_block(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Failed");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (144:45) 
    function create_if_block_5(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Disconnect");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (142:46) 
    function create_if_block_4(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Connecting...");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (140:6) {#if connectState === 'disconnected'}
    function create_if_block_3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Connect");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (147:4) {#if serviceList.length}
    function create_if_block_2(ctx) {
    	let select;
    	let option;
    	let t;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*serviceList*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			select = element("select");
    			option = element("option");
    			t = text("Select service...");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option.selected = true;
    			option.disabled = true;
    			option.__value = undefined;
    			option.value = option.__value;
    			if (/*selectedServiceUUID*/ ctx[5] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[9].call(select));
    		},
    		m(target, anchor) {
    			insert(target, select, anchor);
    			append(select, option);
    			append(option, t);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*selectedServiceUUID*/ ctx[5]);

    			if (!mounted) {
    				dispose = listen(select, "change", /*select_change_handler*/ ctx[9]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*serviceList*/ 1) {
    				each_value_1 = /*serviceList*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}

    			if (dirty & /*selectedServiceUUID, serviceList, undefined*/ 33) {
    				select_option(select, /*selectedServiceUUID*/ ctx[5]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(select);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (150:8) {#each serviceList as service}
    function create_each_block_1(ctx) {
    	let option;
    	let t_value = /*service*/ ctx[7].readableName + "";
    	let t;
    	let option_value_value;

    	return {
    		c() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*service*/ ctx[7].uuid;
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*serviceList*/ 1 && t_value !== (t_value = /*service*/ ctx[7].readableName + "")) set_data(t, t_value);

    			if (dirty & /*serviceList*/ 1 && option_value_value !== (option_value_value = /*service*/ ctx[7].uuid)) {
    				option.__value = option_value_value;
    			}

    			option.value = option.__value;
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (156:4) {#if characteristicsList.length && selectedServiceUUID}
    function create_if_block_1(ctx) {
    	let select;
    	let option;
    	let t;
    	let mounted;
    	let dispose;
    	let each_value = /*characteristicsList*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c() {
    			select = element("select");
    			option = element("option");
    			t = text("Select characteristic...\n        ");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option.selected = true;
    			option.disabled = true;
    			option.__value = undefined;
    			option.value = option.__value;
    			if (/*selectedCharacteristicUUID*/ ctx[6] === void 0) add_render_callback(() => /*select_change_handler_1*/ ctx[10].call(select));
    		},
    		m(target, anchor) {
    			insert(target, select, anchor);
    			append(select, option);
    			append(option, t);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*selectedCharacteristicUUID*/ ctx[6]);

    			if (!mounted) {
    				dispose = listen(select, "change", /*select_change_handler_1*/ ctx[10]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*characteristicsList*/ 2) {
    				each_value = /*characteristicsList*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*selectedCharacteristicUUID, characteristicsList, undefined*/ 66) {
    				select_option(select, /*selectedCharacteristicUUID*/ ctx[6]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(select);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (161:8) {#each characteristicsList as ch}
    function create_each_block$1(ctx) {
    	let option;
    	let t_value = /*ch*/ ctx[16].readableName + "";
    	let t;
    	let option_value_value;

    	return {
    		c() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*ch*/ ctx[16].uuid;
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*characteristicsList*/ 2 && t_value !== (t_value = /*ch*/ ctx[16].readableName + "")) set_data(t, t_value);

    			if (dirty & /*characteristicsList*/ 2 && option_value_value !== (option_value_value = /*ch*/ ctx[16].uuid)) {
    				option.__value = option_value_value;
    			}

    			option.value = option.__value;
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (168:4) {#if device && connectState === 'connected'}
    function create_if_block$2(ctx) {
    	let h3;
    	let t0;
    	let t1_value = /*device*/ ctx[2].name + "";
    	let t1;
    	let t2;
    	let t3_value = /*device*/ ctx[2].id + "";
    	let t3;
    	let t4;

    	return {
    		c() {
    			h3 = element("h3");
    			t0 = text("Device: ");
    			t1 = text(t1_value);
    			t2 = text(" (");
    			t3 = text(t3_value);
    			t4 = text(")");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			append(h3, t0);
    			append(h3, t1);
    			append(h3, t2);
    			append(h3, t3);
    			append(h3, t4);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*device*/ 4 && t1_value !== (t1_value = /*device*/ ctx[2].name + "")) set_data(t1, t1_value);
    			if (dirty & /*device*/ 4 && t3_value !== (t3_value = /*device*/ ctx[2].id + "")) set_data(t3, t3_value);
    		},
    		d(detaching) {
    			if (detaching) detach(h3);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let warning;
    	let t0;
    	let h3;
    	let t1;
    	let t2;
    	let t3;
    	let div2;
    	let div0;
    	let button;
    	let button_disabled_value;
    	let t4;
    	let t5;
    	let t6;
    	let br0;
    	let t7;
    	let t8;
    	let br1;
    	let t9;
    	let span0;
    	let t10_value = "Selected service:" + "";
    	let t10;
    	let t11;

    	let t12_value = (/*selectedServiceUUID*/ ctx[5]
    	? `0x${/*selectedServiceUUID*/ ctx[5].toString("16")}`
    	: "none") + "";

    	let t12;
    	let t13;
    	let br2;
    	let t14;
    	let span1;
    	let t15_value = "Selected characteristic:" + "";
    	let t15;
    	let t16;

    	let t17_value = (/*selectedCharacteristicUUID*/ ctx[6]
    	? `0x${/*selectedCharacteristicUUID*/ ctx[6].toString("16")}`
    	: "none") + "";

    	let t17;
    	let t18;
    	let div1;
    	let characteristic_1;
    	let t19;
    	let hr;
    	let t20;
    	let messagelog;
    	let t21;
    	let footer;
    	let current;
    	let mounted;
    	let dispose;
    	warning = new Warning({});

    	function select_block_type(ctx, dirty) {
    		if (/*connectState*/ ctx[4] === "disconnected") return create_if_block_3;
    		if (/*connectState*/ ctx[4] === "connecting") return create_if_block_4;
    		if (/*connectState*/ ctx[4] === "connected") return create_if_block_5;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*serviceList*/ ctx[0].length && create_if_block_2(ctx);
    	let if_block2 = /*characteristicsList*/ ctx[1].length && /*selectedServiceUUID*/ ctx[5] && create_if_block_1(ctx);
    	let if_block3 = /*device*/ ctx[2] && /*connectState*/ ctx[4] === "connected" && create_if_block$2(ctx);
    	characteristic_1 = new Characteristic({ props: { ch: /*characteristic*/ ctx[3] } });
    	messagelog = new MessageLog({});
    	footer = new Footer({});

    	return {
    		c() {
    			create_component(warning.$$.fragment);
    			t0 = space();
    			h3 = element("h3");
    			t1 = text("Status: ");
    			t2 = text(/*connectState*/ ctx[4]);
    			t3 = space();
    			div2 = element("div");
    			div0 = element("div");
    			button = element("button");
    			if_block0.c();
    			t4 = space();
    			if (if_block1) if_block1.c();
    			t5 = space();
    			if (if_block2) if_block2.c();
    			t6 = space();
    			br0 = element("br");
    			t7 = space();
    			if (if_block3) if_block3.c();
    			t8 = space();
    			br1 = element("br");
    			t9 = space();
    			span0 = element("span");
    			t10 = text(t10_value);
    			t11 = space();
    			t12 = text(t12_value);
    			t13 = space();
    			br2 = element("br");
    			t14 = space();
    			span1 = element("span");
    			t15 = text(t15_value);
    			t16 = space();
    			t17 = text(t17_value);
    			t18 = space();
    			div1 = element("div");
    			create_component(characteristic_1.$$.fragment);
    			t19 = space();
    			hr = element("hr");
    			t20 = space();
    			create_component(messagelog.$$.fragment);
    			t21 = space();
    			create_component(footer.$$.fragment);
    			attr(h3, "class", "svelte-1wuktin");
    			toggle_class(h3, "connected", /*connectState*/ ctx[4] === "connected");
    			toggle_class(h3, "connecting", /*connectState*/ ctx[4] === "connecting");
    			toggle_class(h3, "failed", /*connectState*/ ctx[4] === "failed");
    			button.disabled = button_disabled_value = /*connectState*/ ctx[4] === "connecting";
    			attr(div0, "class", "svelte-1wuktin");
    			attr(div1, "class", "svelte-1wuktin");
    			attr(div2, "class", "double-side svelte-1wuktin");
    		},
    		m(target, anchor) {
    			mount_component(warning, target, anchor);
    			insert(target, t0, anchor);
    			insert(target, h3, anchor);
    			append(h3, t1);
    			append(h3, t2);
    			insert(target, t3, anchor);
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div0, button);
    			if_block0.m(button, null);
    			append(div0, t4);
    			if (if_block1) if_block1.m(div0, null);
    			append(div0, t5);
    			if (if_block2) if_block2.m(div0, null);
    			append(div0, t6);
    			append(div0, br0);
    			append(div0, t7);
    			if (if_block3) if_block3.m(div0, null);
    			append(div0, t8);
    			append(div0, br1);
    			append(div0, t9);
    			append(div0, span0);
    			append(span0, t10);
    			append(span0, t11);
    			append(span0, t12);
    			append(div0, t13);
    			append(div0, br2);
    			append(div0, t14);
    			append(div0, span1);
    			append(span1, t15);
    			append(span1, t16);
    			append(span1, t17);
    			append(div2, t18);
    			append(div2, div1);
    			mount_component(characteristic_1, div1, null);
    			insert(target, t19, anchor);
    			insert(target, hr, anchor);
    			insert(target, t20, anchor);
    			mount_component(messagelog, target, anchor);
    			insert(target, t21, anchor);
    			mount_component(footer, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*manipulateConnection*/ ctx[8]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*connectState*/ 16) set_data(t2, /*connectState*/ ctx[4]);

    			if (dirty & /*connectState*/ 16) {
    				toggle_class(h3, "connected", /*connectState*/ ctx[4] === "connected");
    			}

    			if (dirty & /*connectState*/ 16) {
    				toggle_class(h3, "connecting", /*connectState*/ ctx[4] === "connecting");
    			}

    			if (dirty & /*connectState*/ 16) {
    				toggle_class(h3, "failed", /*connectState*/ ctx[4] === "failed");
    			}

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(button, null);
    				}
    			}

    			if (!current || dirty & /*connectState*/ 16 && button_disabled_value !== (button_disabled_value = /*connectState*/ ctx[4] === "connecting")) {
    				button.disabled = button_disabled_value;
    			}

    			if (/*serviceList*/ ctx[0].length) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(div0, t5);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*characteristicsList*/ ctx[1].length && /*selectedServiceUUID*/ ctx[5]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_1(ctx);
    					if_block2.c();
    					if_block2.m(div0, t6);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*device*/ ctx[2] && /*connectState*/ ctx[4] === "connected") {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block$2(ctx);
    					if_block3.c();
    					if_block3.m(div0, t8);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if ((!current || dirty & /*selectedServiceUUID*/ 32) && t12_value !== (t12_value = (/*selectedServiceUUID*/ ctx[5]
    			? `0x${/*selectedServiceUUID*/ ctx[5].toString("16")}`
    			: "none") + "")) set_data(t12, t12_value);

    			if ((!current || dirty & /*selectedCharacteristicUUID*/ 64) && t17_value !== (t17_value = (/*selectedCharacteristicUUID*/ ctx[6]
    			? `0x${/*selectedCharacteristicUUID*/ ctx[6].toString("16")}`
    			: "none") + "")) set_data(t17, t17_value);

    			const characteristic_1_changes = {};
    			if (dirty & /*characteristic*/ 8) characteristic_1_changes.ch = /*characteristic*/ ctx[3];
    			characteristic_1.$set(characteristic_1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(warning.$$.fragment, local);
    			transition_in(characteristic_1.$$.fragment, local);
    			transition_in(messagelog.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(warning.$$.fragment, local);
    			transition_out(characteristic_1.$$.fragment, local);
    			transition_out(messagelog.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(warning, detaching);
    			if (detaching) detach(t0);
    			if (detaching) detach(h3);
    			if (detaching) detach(t3);
    			if (detaching) detach(div2);
    			if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			destroy_component(characteristic_1);
    			if (detaching) detach(t19);
    			if (detaching) detach(hr);
    			if (detaching) detach(t20);
    			destroy_component(messagelog, detaching);
    			if (detaching) detach(t21);
    			destroy_component(footer, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let serviceList = [];
    	let characteristicsList = [];
    	let device;
    	let gattServer;
    	let service;
    	let characteristic;
    	let connectState = "disconnected";
    	let selectedServiceUUID;
    	let selectedCharacteristicUUID;

    	const bleOptions = {
    		acceptAllDevices: true,
    		optionalServices: ALL_SERVICES.map(s => s.uuid)
    	};

    	async function interact() {
    		$$invalidate(11, gattServer = await device.gatt.connect());
    		$$invalidate(4, connectState = "connected");
    		console.log("GATT server:", gattServer);
    		const services = await gattServer.getPrimaryServices();
    		console.log("Services list:", services);

    		$$invalidate(0, serviceList = services.map(s => {
    			const n = parseInt(s.uuid.split("-").shift(), 16);
    			const matched = ALL_SERVICES.find(s => s.uuid === n);
    			return matched;
    		}).filter(s => s));

    		$$invalidate(1, characteristicsList = CHARACTERISTICS);
    	}

    	function reqConnect() {
    		navigator.bluetooth.requestDevice(bleOptions).then(
    			d => {
    				console.log("Device:", d);
    				$$invalidate(2, device = d);
    				$$invalidate(4, connectState = "connecting");
    				device.addEventListener("gattserverdisconnected", reset);
    				return interact();
    			},
    			err => {
    				log(err);
    				reset();
    			}
    		);
    	}

    	function manipulateConnection() {
    		if (!navigator.bluetooth) {
    			log("Your device doesn't support BLE API.", "error");
    		}

    		if (connectState === "disconnected") {
    			reqConnect();
    		} else if (connectState === "connected") {
    			device.gatt.disconnect();
    			reset();
    		}
    	}

    	function reset() {
    		$$invalidate(11, gattServer = null);
    		$$invalidate(7, service = null);
    		$$invalidate(3, characteristic = null);
    		$$invalidate(4, connectState = "disconnected");
    		$$invalidate(0, serviceList = []);
    		$$invalidate(1, characteristicsList = []);
    		$$invalidate(6, selectedCharacteristicUUID = $$invalidate(5, selectedServiceUUID = undefined));
    	}

    	function select_change_handler() {
    		selectedServiceUUID = select_value(this);
    		$$invalidate(5, selectedServiceUUID);
    		$$invalidate(0, serviceList);
    	}

    	function select_change_handler_1() {
    		selectedCharacteristicUUID = select_value(this);
    		$$invalidate(6, selectedCharacteristicUUID);
    		$$invalidate(1, characteristicsList);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*gattServer, selectedServiceUUID*/ 2080) {
    			 {
    				if (gattServer && selectedServiceUUID) {
    					gattServer.getPrimaryService(selectedServiceUUID).then(s => $$invalidate(7, service = s)).catch(log);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*gattServer, service, selectedCharacteristicUUID*/ 2240) {
    			 {
    				if (gattServer && service && selectedCharacteristicUUID) {
    					service.getCharacteristic(selectedCharacteristicUUID).then(ch => $$invalidate(3, characteristic = ch)).catch(log);
    				}
    			}
    		}
    	};

    	return [
    		serviceList,
    		characteristicsList,
    		device,
    		characteristic,
    		connectState,
    		selectedServiceUUID,
    		selectedCharacteristicUUID,
    		service,
    		manipulateConnection,
    		select_change_handler,
    		select_change_handler_1
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-1wuktin-style")) add_css$2();
    		init(this, options, instance$3, create_fragment$4, safe_not_equal, {});
    	}
    }

    window.addEventListener('DOMContentLoaded', function() {
      new App({
        target: document.querySelector('#root'),
      });
    });

    // Must register serviceWorker...

}());
