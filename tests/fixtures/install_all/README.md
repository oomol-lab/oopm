
### Dependency Graph

```txt
entry
    a: 0.0.1
        c: 0.0.2
        d: 0.0.1
    b: 0.0.1
        e: 0.0.1
    c: 0.0.1
```

#### Local Storage (Already exists locally)

```txt
e: 0.0.1
c: 0.0.1
```

#### Remote Storage (Needs to be installed)

```txt
a: 0.0.1
b: 0.0.1
c: 0.0.2
d: 0.0.1
e: 0.0.1
```

### Installation Logic

1. Only install the `a:0.0.1` `b:0.0.1` `c:0.0.2` `d:0.0.1` `e:0.0.1` dependencies.
2. Do not install the `c:0.0.1` dependency as it is already installed locally.
3. Do install the `e:0.0.1` dependency as it is sub-dependency of `b:0.0.1`.
   1. _oopm_ don't know about this sub-dependency as it is not mentioned in the `entry` package.
   2. _oopm_ will not overwrite the existing _Local Storage_ `e:0.0.1`; it will simply skip it.
