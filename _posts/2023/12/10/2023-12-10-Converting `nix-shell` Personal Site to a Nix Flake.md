---
layout: post
title: Converting nix-shell Personal Site to a nix flake
summary: In this post, I will explore the benefits of swapping from nix-shell to a nix flake and outline the process. Don't worry, it really isn't difficult. I had some minor issues with uncss that I will also discuss.
thumbnail-img: /assets/img/thumbnails/jekyll-on-nix-flake.jpg
readtime: true
toc: true
tags:
  - nix
  - jekyll
---

# Converting `nix-shell` Personal Site to a Nix Flake

As mentioned in [this post](https://blog.yuribocharov.dev/posts/2023/08/09/developing-a-jekyll-site-on-nixos), I have finally converted my personal site, previously configured as a `nix-shell`, into a Nix Flake. In this post, I will explore the benefits of this transition and outline the process. Don't worry, it really isn't difficult.

## Motivation

The decision to make this transition stemmed from two primary reasons: curiosity and loading times.

In a separate project, I established my environment as a flake using `direnv` to automatically initiate the environment upon entering the relevant directory. This workflow proved to be highly convenient, prompting my curiosity about how easily I could implement the same for my personal site.

The main performance-driven motivation for converting to a flake is improved load times. Although the specifics are not clear to me, it appears that `nix-shell` recalculates the paths for its dependencies every time it boots up. On the contrary, a `nix flake` seems to cache that information.

In terms of functionality, assuming a flake is just as user-friendly, there is no reason not to prefer it over a shell. (Note: While technically flakes are considered unstable, it seems like they are here to stay.)

## Migration

I used the following Nix flakes as a baseline and seamlessly moved all my `nix-shell` related configurations into it. I have decided not to include the node portions from my `nix-shell` as I found no value in retaining them within the flake.

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**The original flake is not my work.**\\
> I obtained the Nix flake from [here](https://github.com/the-nix-way/nix-flake-dev-environments). The repository contains additional useful flakes for various Nix development setups, including Go, Python, Rust, etc.

Recall that the original Nix shell configuration looked something like this:

```nix
# Original nix-shell configuration
with import <nixpkgs> { };
let
  env = bundlerEnv {
    ruby = pkgs.ruby;
    name = "personal_site-bundler-env";
    gemfile = ./Gemfile;
    lockfile = ./Gemfile.lock;
    gemset = ./gemset.nix;
    gemConfig = {
      ...
    };
  };
in
stdenv.mkDerivation {
  name = "personal_site";
  buildInputs = with pkgs; [ nodejs bundix ] ++ [ env ];

  shellHook = ''
    export PATH="${nodeDependencies}/bin:$PATH"
  '';
}
```

We need to move three things:

2. Move the let declarations

```nix
...
flake-utils.lib.eachDefaultSystem (system:
let
  overlays = [
    (self: super: {
      ruby = pkgs.ruby_3_2;
    })
    (final: prev: rec {
      nodejs = prev.nodejs-18_x;
    })

  ];
  pkgs = import nixpkgs { inherit overlays system; };

  rubyEnv = pkgs.bundlerEnv {
    inherit (pkgs) ruby;
    name = "personal_site-bundler-env";
    gemfile = ./Gemfile;
    lockfile = ./Gemfile.lock;
    gemset = ./gemset.nix;
    gemConfig = {
      ruby-vips = attrs: {
        dontBuild = false;
        postInstall = with pkgs; ''
          cd "$(cat $out/nix-support/gem-meta/install-path)"

          substituteInPlace lib/vips.rb \
            --replace "library_name('vips', 42)" '"${lib.getLib vips}/lib/libvips${stdenv.hostPlatform.extensions.sharedLibrary}"' \
            --replace "library_name('glib-2.0', 0)" '"${glib.out}/lib/libglib-2.0${stdenv.hostPlatform.extensions.sharedLibrary}"' \
            --replace "library_name('gobject-2.0', 0)" '"${glib.out}/lib/libgobject-2.0${stdenv.hostPlatform.extensions.sharedLibrary}"'
        '';
      };
      sass-embedded = attrs: {
        DART_SASS = pkgs.fetchurl {
          url = "https://github.com/sass/dart-sass/releases/download/1.64.2/dart-sass-1.64.2-linux-x64.tar.gz";
          sha256 = "sha256-+RmtceWz5K2xaJZvuaJs31tocby4H/LwBBV15DRBCzs";
        };
      };
    };
  };
...
```

3.  Move the build inputs

```diff
devShells = forEachSupportedSystem ({ pkgs }: {
  default = pkgs.mkShell {
    buildInputs = with pkgs; [  nodejs bundix ] ++ [ rubyEnv ];
  };
```

### A Quick Diversion

I encountered several issues with `uncss` and similar programs designed to remove unneeded CSS. Despite trying multiple PostCSS plugins, I faced challenges retaining specific CSS selectors that were being used by JavaScript.

I eventually settled on `jekyll-uncss`, which makes CLI calls to `uncss` under the hood. However, after transitioning to the flake, a new issue arose—my CSS styles disappeared in production, albeit only locally. The production site on Netlify remained unaffected, and inspecting the CSS files revealed the message `sh: line 1: uncss: command not found.`

Fortunately, the file `uncss.rb` resides locally, allowing for print statement debugging. I traced the problem to this line: `result = "uncss --uncssrc '#{path}' '#{files}' 2>&1"`. result returned `sh: line 1: uncss: command not found`. Changing the call to `node_modules/uncss/bin/uncss` resolved the issue, indicating a path problem leading to the `uncss` executable not being found.

Given that the code currently works in production, I made a small change to the flake shell hook to ensure `uncss` is added to the path: `PATH="./node_modules/uncss/bin:$PATH"`.

That is why the shell hook has changed and leading to step 3:

3. Moving the shell hook

```diff
devShells = forEachSupportedSystem ({ pkgs }: {
  default = pkgs.mkShell {
    buildInputs = with pkgs; [ nodejs bundix ] ++ [ rubyEnv ];
+   shellHook = ''
+      PATH="./node_modules/uncss/bin:$PATH"
+   '';
  };
});
```

The result:

```nix
{
  description = "Jekyll blog";

  inputs = {
    nixpkgs.url = "nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    nix-filter.url = "github:numtide/nix-filter";
  };

  outputs =
    { self
    , nixpkgs
    , flake-utils
    , nix-filter
    ,
    }:
    flake-utils.lib.eachDefaultSystem (system:
    let
      overlays = [
        (self: super: {
          ruby = pkgs.ruby_3_2;
        })
        (final: prev: rec {
          nodejs = prev.nodejs-18_x;
        })

      ];
      pkgs = import nixpkgs { inherit overlays system; };

      rubyEnv = pkgs.bundlerEnv {
        inherit (pkgs) ruby;
        name = "personal_site-bundler-env";
        gemfile = ./Gemfile;
        lockfile = ./Gemfile.lock;
        gemset = ./gemset.nix;
        gemConfig = {
          ruby-vips = attrs: {
            dontBuild = false;
            postInstall = with pkgs; ''
              cd "$(cat $out/nix-support/gem-meta/install-path)"

              substituteInPlace lib/vips.rb \
                --replace "library_name('vips', 42)" '"${lib.getLib vips}/lib/libvips${stdenv.hostPlatform.extensions.sharedLibrary}"' \
                --replace "library_name('glib-2.0', 0)" '"${glib.out}/lib/libglib-2.0${stdenv.hostPlatform.extensions.sharedLibrary}"' \
                --replace "library_name('gobject-2.0', 0)" '"${glib.out}/lib/libgobject-2.0${stdenv.hostPlatform.extensions.sharedLibrary}"'
            '';
          };
          sass-embedded = attrs: {
            DART_SASS = pkgs.fetchurl {
              url = "https://github.com/sass/dart-sass/releases/download/1.64.2/dart-sass-1.64.2-linux-x64.tar.gz";
              sha256 = "sha256-+RmtceWz5K2xaJZvuaJs31tocby4H/LwBBV15DRBCzs";
            };
          };
        };
      };
    in
    {
      devShells = rec {
        default = run;

        run = pkgs.mkShell {
          buildInputs = with pkgs; [ nodejs bundix ] ++ [ rubyEnv ];

          shellHook = ''
            PATH="./node_modules/uncss/bin:$PATH"
            export NIX_SHELL="true"
          '';
        };
      };
    });
}
```

## Conclusion

Even now I don't fully understand **what** a flake really but the process for the transition was not hard. Finding a suitable template was crucial but once I found the template, I could seamlessly transfer everything I had built for the `nix-shell`.

However, this process sheds light on the confusion and complexity within the Nix ecosystem. Despite having been experimenting with Nix for around 5-6 months now, much of what I do still feels like arcane incantations. I find myself relying on copying and pasting solutions from others which suggests that the documentation and learning resources could benefit from improvement. Perhaps, as I continue to learn, I should actively contribute to that change instead of sitting around and being critical.
