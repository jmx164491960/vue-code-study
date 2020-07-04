
window.watcherList = [];

function parseDom(arg) {

　　 var objE = document.createElement("div");

　　 objE.innerHTML = arg;

　　 return objE.childNodes[0];

};

class Vue {
    rootNode = null;
    data = {};
    constructor(params) {
        if (params.el) {
            this.rootNode = document.querySelector(params.el);
        }

        if (params.data) {
            this.data = params.data();

            Object.keys(this.data).forEach(key => {
                defineReactive(this.data, key, this.data[key]);
            });
        }
        this.render(params.render);

        return this;
    }
    
    render(getTpl) {
        const watcher = new Watcher(getTpl, this.rootNode, this);
        window.watcherList.push(watcher);
    }


}

class Dep {
    subs = [];
    notify() {
        this.subs.forEach((sub) => {
            sub.update(this.obj, this.key);
        });
    }
    depend() {
        if (Dep.target) {
            Dep.target.addDep(this)
        }
    }

    addSub (sub) {
        this.subs.push(sub)
    }
}
Dep.target = undefined;

class Watcher {
    node = null;
    constructor(getTpl, parentNode, vm) {
        this.get(this);
        this.node = document.createElement('div');
        parentNode.append(this.node);
        this.update = (obj, key) => {
            const node  = parseDom(getTpl.call(vm));
            node.addEventListener('change', (event) => {
                debugger
                obj[key] = event.target.value;
            })
            parentNode.replaceChild(node, this.node);
            this.node = node;
        }
        this.update();
        this.get();
    }

    get(target) {
        Dep.target = target;
    }

    update() {

    }

    addDep(dep) {
        dep.addSub(this);
    }
}

function defineReactive(obj, key, val) {

    let dep = new Dep();
    dep.obj = obj;
    dep.key = key;

    const property = Object.getOwnPropertyDescriptor(obj, key)
    if (property && property.configurable === false) {
        return
    }

    // cater for pre-defined getter/setters
    const getter = property && property.get;
    const setter = property && property.set;
    if ((!getter || setter) && arguments.length === 2) {
        val = obj[key]
    }
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function() {
            const value = getter ? getter.call(obj) : val
            if (Dep.target) {
                dep.depend()
            }
            return value;
        },
        set: function(newVal) {
            const value = getter ? getter.call(obj) : val
            if (newVal === value || (newVal !== newVal && value !== value)) {
                return
            }
            if (setter) {
                setter.call(obj, newVal);
            } else {
                val = newVal;
            }
            dep.notify()
        }
    });
}