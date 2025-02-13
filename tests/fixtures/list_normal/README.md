### Dependency Graph

```txt
entry
    a1: 0.0.1
        b1: 0.0.1
        b2: 0.0.1
        b3: 0.0.2
        b4: 0.0.1
    a2: 0.0.1
        b1: 0.0.1
        b2: 0.0.2
            c1: 0.0.1
            c2: 0.0.2
            c3: 0.0.2
    a3: 0.0.2
    a4: 0.0.1
        c2: 0.0.2
        c3: 0.0.2
    a5: 0.0.3
        c4: 0.0.1
```

#### Local Storage (Already exists locally)

```txt
a1: 0.0.1
a2: 0.0.1
a3: 0.0.2
a4: 0.0.1
a5: 0.0.3
b1: 0.0.1
b2: 0.0.2
b3: 0.0.2
b4: 0.0.1
c1: 0.0.1
c2: 0.0.2
c3: 0.0.2
```

### List Logic

1. Recursively check all dependencies.
2. If the dependency is found in the local storage, add it to the result.
3. If the dependency is not found in the local storage, add it to the result but with `distDir` as empty string.
4. If the `package.oo.yaml` is not found, add it to the result but not recursively check its dependencies.
5. If the `package.oo.yaml` is found but invalid, add it to the result but not recursively check its dependencies.
