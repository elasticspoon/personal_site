---
layout: post
title: Bundling Node Modules on Nix
readtime: true
toc: true
tags:
  - nix
  - node
  - javascript
  - npm
  - node_modules
  - package-lock
summary: In this post I cover the process of bundling and pinning all node modules needed for a project using Nix. This is an extension of my earlier post on how to develop a Jekyll site on NixOS.
thumbnail-img: "assets/img/thumbnails/node-on-nix.jpg"
---

# Bundling Node Modules on Nix

This will be a relatively short how-to post, focusing on practical steps rather than in-depth explanations. When we last left the process of packaging our Jekyll site, we had the following as a `shell.nix` file:

```nix
with (import <nixpkgs> { }); let
  env = bundlerEnv {
    name = "personal_site-bundler-env";
    inherit ruby;
    gemfile = ./Gemfile;
    lockfile = ./Gemfile.lock;
    gemset = ./gemset.nix;
    gemConfig = {
      sass-embedded = attrs: {
      DART_SASS = pkgs.fetchurl {
        url = "https://github.com/sass/dart-sass/releases/download/1.64.2/dart-sass-1.64.2-linux-x64.tar.gz";
        sha256 = "sha256-+RmtceWz5K2xaJZvuaJs31tocby4H/LwBBV15DRBCzs=";
    };
  };
    ruby-vips = attrs: {
      postInstall = ''
        cd "$(cat $out/nix-support/gem-meta/install-path)"

        substituteInPlace lib/vips.rb \
        --replace "library_name('vips', 42)" '"${lib.getLib vips}/lib/libvips${stdenv.hostPlatform.extensions.sharedLibrary}"' \
        --replace "library_name('glib-2.0', 0)" '"${glib.out}/lib/libglib-2.0${stdenv.hostPlatform.extensions.sharedLibrary}"' \
        --replace "library_name('gobject-2.0', 0)" '"${glib.out}/lib/libgobject-2.0${stdenv.hostPlatform.extensions.sharedLibrary}"'
      '';
    };
  };
};
in
stdenv.mkDerivation {
  name = "personal_site";
  buildInputs = [ env pkgs.nodejs];
}
```

The expectation with this code is that you will run `nix-shell`, and within that shell, you will run `npm install` to install all the node modules you need. But imagine you want to ensure **all** dependencies are covered by the shell. How do you add them?

## `node2nix` - Node Modules Version of `bundix`

It would be nice if we could just include all the dependencies we need directly in `buildInputs`, but such an option is not viable. Unfortunately, node module dependencies are too sprawling and complicated for us to take that approach. Furthermore, many node modules are not packaged in Nix ([the ones that are can be found here](https://search.nixos.org/packages#?channel=23.05&from=0&size=50&sort=relevance&type=packages&query=nodePackages)). Thus, [we will use `node2nix`, a tool](https://github.com/svanderburg/node2nix) very similar to `bundix`.

We can add `node2nix` to our `buildInputs` if we are fine working with it exclusively in the shell or install it system-wide by adding `nodePackages.node2nix` to your Nix programs. The [github page has instructions](https://github.com/svanderburg/node2nix#installation) on how to do a `nix-env` install as well.

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**Derivation Assumptions**\\
> All the following steps assume that you have already used and installed the node modules before. That is, you have a working `package-lock.json` file with the needed modules and dependencies. If you don't have that, you are going to need to follow the documentation on [how to initialize an npm package](https://docs.npmjs.com/cli/v9/commands/npm-init) and [how to install modules to it](https://docs.npmjs.com/cli/v9/commands/npm-install).

## Building Our Derivation

The primary information we are going to need for `node2nix` is our `package-lock.json` file. This file is automatically generated by `npm` when we install packages so we should already have it.

Similar to how `bundix` used the `--magic` command to get us started, we are going to use the `node2nix -l package-lock.json` command.

```console
$ > git status
On branch wip
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   default.nix

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        node-env.nix
        node-packages.nix
```

We won't be using `default.nix`, but the contents do provide a good foundation to append to our `shell.nix`. `default.nix` is the default file that the `nix develop` command runs, creating `result` file which can be run with multiple strategies. Those strategies can be seen in the `node-env.nix` file, including building a shell, a package, and others. Since our purpose is only `nix-shell`, we prefer not to have an additional file polluting our directory.

## Using the Node Environment in Other Derivations

Our goal now is to integrate `node-env.nix` into our `shell.nix` file. The documentation for `node2nix` [provides a good starting point](https://github.com/svanderburg/node2nix#using-the-nodejs-environment-in-other-nix-derivations). We can drop all that directly into our `shell.nix`.

```nix
with import <nixpkgs> { }; let
  env = bundlerEnv {
  # ...
  };
  nodeDependencies = (pkgs.callPackage ./default.nix { }).nodeDependencies;
in
stdenv.mkDerivation {
  name = "personal_site";
  buildInputs = [ env pkgs.nodejs pkgs.bundix ];
  buildPhase = ''
    ln -s ${nodeDependencies}/lib/node_modules ./node_modules
    export PATH="${nodeDependencies}/bin:$PATH"
  '';
}
```

There are two issues here. First, we are actually using `default.nix`, something that we wanted to avoid, so we will need to refactor that code. More significantly, we are adding a symbolic link to the `node_modules` folder in the `buildPhase`. If you remember our discussion of the `nix-shell`, the build phase does not actually occur in the shell environment.

The fix for `buildPhase` is easy. We simply do that same instruction in a `shellHook` instead.

```diff
- buildPhase = ''
+ shellHook = ''

-  ln -s ${nodeDependencies}/lib/node_modules ./node_modules
+  if [ ! -L "./node_modules" ]; then
+    ln -s "${nodeDependencies}/lib/node_modules" ./node_modules
+  fi
  export PATH="${nodeDependencies}/bin:$PATH"
'';
```

We are also going to do a _tiny_ bit of fancy scripting. We care going to check if a symbolic link to `node_modules` is missing, and only then create one.

### Refactoring `default.nix`

Referring to what we are about to do as 'refactoring' might be a bit of an exaggeration. In reality, we want to just take all the code from `default.nix` and move it into `shell.nix`. That will look something like this:

```nix
nodeEnv = import ./node-env.nix {
  inherit (pkgs) stdenv lib python2 runCommand writeTextFile writeShellScript;
  inherit pkgs nodejs[]();
  libtool =
    if pkgs.stdenv.isDarwin
      then pkgs.darwin.cctools
    else null;
  };
nodeDependencies =
  (import ./node-packages.nix
  {
    inherit (pkgs) fetchurl nix-gitignore stdenv lib fetchgit;
    inherit nodeEnv;
  }).nodeDependencies;
```

## Troubleshooting

Now that we have the environment fully set up, we can finally run `nix-shell`. And just like that, we get another error.

```console
pinpointing versions of dependencies...
WARNING: cannot pinpoint dependency: postcss, context: /nix/store/0knvrbaq1j0mrhisg7xzfh04cy9p45c4-node-dependencies-personal_site-1.0.0/personal_site
patching script interpreter paths in .
Sorry, I only understand lock file versions 1 and 2!
```

Unfortunately, `node2nix` does not support version 3 of `package-lock`. [Github provides us with a fairly simple solution](https://github.com/svanderburg/node2nix/issues/312): running `npm install --lockfile-version 2` to downgrade our lockfile to an older version. This is a far from an ideal situation, but unfortunately, I don't see a better solution.

So let's run `npm install --lockfile-version 2`, followed by `node2nix -l package-lock.json` to ensure our environment and packages are up to date.node

Finally, `nix-shell` works. And `bundle exec jekyll serve` works as well.

## Conclusion

Congratulations! You have packaged all the node modules needed for your site with Nix. Unfortunately, the process is more brittle than I'd like, and the necessity of downgrading our `package-lock` file makes it seem like a fairly bad idea.

I haven't tested too many node modules; however, unlike with Ruby gems, I have not had issues just installing the files with `npm install` while inside the shell. Also, keep in mind Nix also provides many of the packages in `pkgs.nodePackages.package-name`.

This post was mainly done out of curiosity about how the node packaging process works. I would not actually recommend taking this approach to work on a real project.
