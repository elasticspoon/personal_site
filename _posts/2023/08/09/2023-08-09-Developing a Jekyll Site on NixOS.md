---
layout: post
title: Developing a Jekyll site on NixOS
readtime: true
tags:
  - nix
  - ruby
  - jekyll
  - ruby-vips
  - sass-embedded
  - sass
toc: true
summary: In this post I detail the process of setting up an environment to develop a Jekyll site on NixOS. I use nix-shell to ensure the environment is consistent and troubleshoot many issues with gems includes sass and ruby-vips.
---

# Developing a Jekyll Site on NixOS

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**This post is long**\\
> I won't fault you if you are trying to solve your own issue and want to skip to the end. (Or if you think I am a terrible writer). [So here is a link.](/posts/2023/08/09/Developing-a-Jekyll-Site-on-NixOS.html#final-code)

## Why Am I Writing This Post?

At some point in time I decided that I wanted to switch from running Linux on a virtual machine to having an installation on my home computer. I shan't go too deep about the value of Nix (that will be another post), suffice to say I decided to try NixOS for as my Linux distribution of choice.

After setting up my machine and getting everything configured how I like I wanted to make some updates to my personal website. It is a basic statically generated site using Jekyll as well as a few Node libraries and Vips for image transformation. My first attempt was to simply run `bundle install` (which worked fine) and run the site. It is not quite that easy on Nix.

NixOS and the `ruby-vips` would not work due to expectations it has about library locations. Thus, I had to find a solution and after some research I found `nix-shell` (not to be confused with `nix shell`).

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**On the Nix Ecosystem**\\
> The Nix ecosystem is still not fully mature so there are competing options in terms of how you might approach having temporary dependencies. Those options being `nix-shell` and `nix develop` coupled with Nix flakes. Flakes are currently an "experimental" feature and there was more documentation and content written about the shell option. Thus, I chose to follow the `nix-shell` route. I might explore the flake route in the future.

### What is `nix-shell`?

Lets take a look at what the docs say:

> The command `nix-shell` will build the dependencies of the specified derivation, but not the derivation itself. It will then start an interactive shell in which all environment variables defined by the derivation path have been set to their corresponding values, and the script `$stdenv/setup` has been sourced. This is useful for reproducing the environment of a derivation for development.

That is great explanation if one actually knows what a derivation is. A **derivation** is just a fancy name for a build task in Nix. It requires:

- An attribute `system` for example `x86_64-linux`
- An attribute `name` for `nix-env` to use for packaging
- An attribute `builder` which dictates what program will do the building (typically something like `${bash}/bin/bash`)
- Any other variables will get sent to the build script as environment variables
- For more info you can check the [docs](https://nixos.org/manual/nix/stable/language/derivations) or [this nix "pill"](https://nixos.org/guides/nix-pills/our-first-derivation)

So back to the definition from the documents, what exactly does `nix-shell` do? It does all the prep work for building the derivation (downloads all dependencies, adds them to `PATH`, etc) and stops just before running the `genericBuild` function which would build the derivation.

So how does this help us? It means that with a properly set up shell we will have an ephemeral environment that will have all the dependencies need to run out Jekyll website but we won't need to install anything. In the future, on any system with Nix we will be able to run `nix-shell` and we will be able to serve our site.

That sounds compelling. How do we get there?

## Starting Point

My initial starting point for making this website work on Nix already included several base like programs including the Ruby, Bundler, Bundix, NodeJs and Npm. The final package that I ended up creating also works without any of those dependencies but building it without them is a pain.

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**On a completely "pure" build**\\
> `nix-shell` provides the flag `--pure` if you want to try to work on the dependency in a completely pure environment. However, I don't really recommend it. The process of building itself has many more dependencies than running the site. You are going to quickly run into issues like needing libraries for SSL certificates and other issues.

Thus, what do we actually need to get started?

- [Nix](https://nixos.org/) - we are trying to make this work on Nix
- [Ruby](https://search.nixos.org/packages?channel=23.05&show=ruby&from=0&size=50&sort=relevance&type=packages&query=ruby) - Jekyll is written in Ruby
- [Bundix](https://github.com/nix-community/bundix) - a Nix package to simplify getting all the gems we need

## Getting Started

Normally, when setting up this project you would `bundle install` to get all your gems for local use. Bundix does a pretty similar thing. We can run `bundix --magic` to get started.

```console
$ git status
On branch nix-from-scratch
Untracked files:
  (use "git add <file>..." to include in what will be committed)
        .bundle/
        gemset.nix
        vendor/

nothing added to commit but untracked files present (use "git add" to track)
```

We can see that Bundix did several things:

It created a `.bundle/config` file. This file simply holds basic configuration options that Bundle will use. Such as `BUNDLE_PATH: "vendor/bundle"`, which leads us to the next point.

It created the `vendor` directory. But this is just an intermediary place for the gems. Looking at the logs we can follow what is actually happening under the hood.

```console
Fetching webrick 1.81.1
Installing webrick 1.8.1
# ... other installs ommitted
Bundle complete! 12 Gemfile dependencies, 51 gems now installed.
Bundled gems are installed into `./vendor/bundle`
Updating files in vendor/cache
  * webrick-1.8.1.gem
  # other updates ommited
path is '/nix/store/qjirc89cgjh29d3wi8fz3f23arf2khig-webrick-1.8.1.gem'
13qm7s0gr2pmfcl7dxrmq38asaza4w0i2n9my4yzs499j731wh8r => webrick-1.8.1.gem
# other path fixes ommited
```

First, Bundler fetches and installs the gem locally. The config options tell it: install the gems to the vendor directory, install all gems locally, even ones already present on the system. Next Bundix stores all the gems in the nix store in paths like `/nix/store/somehash…-gem-name-version.gem`. These values are used in the `gemset.nix` file. We can now delete the directory `vendor/`.

Finally, the `gemset.nix` file is the nix derivation that describes all the gems used in the project as well as dependencies, etc.

### So How Do We Run It?

Ok, we are close but not quite there. We are gonna need to run 1 more command `bundix --init`. Which will create the nix shell file that we will be using:

```nix
# shell.nix
with (import <nixpkgs> {});
let
  env = bundlerEnv {
    name = "personal_site-bundler-env";
    inherit ruby;
    gemfile  = ./Gemfile;
    lockfile = ./Gemfile.lock;
    gemset   = ./gemset.nix;
  };
in stdenv.mkDerivation {
  name = "personal_site";
  buildInputs = [ env ];
}
```

What is going on here? Honestly, I am not fully sure how it works under the hood. But long story short, Nix will add all them gems from `gemset.nix` to the `$PATH` and then a [default build script will run and build the shell](https://github.com/NixOS/nixpkgs/blob/master/pkgs/stdenv/generic/setup.sh). So lets try and run it. We can use the command `nix-shell` for that.

## Beginning the Troubleshooting Journey

### Platform Issues

Just like that after running `nix-shell` we run into our first error.

```console
error: hash mismatch in fixed-output derivation '/nix/store/kfmlg207j62qvxvqlvj1c6xv0biqk2c5-sass-embedded-1.63.6.gem.drv':
         specified: sha256-X4goeagmfNKvjFpE+seYwTD3OZyiFgqgi+oagEKnXMo=
            got:    sha256-TdwW90GmOIwkFA2VpWGqau2BwESPd9B0E808W45Pvvw=
```

You might think this means that `gemset.nix` has the wrong SHA in it, but that is not correct. If we look at the `Gemfile.lock` entry for `sass-embedded` we might see something strange. `sass-embedded (1.63.6-x86_64-linux-gnu)`. Where is that `x86` crap coming from?

That is default `bundle` behavior that we enabled when adding `PLATFORMS x86_64-linux` to our `Gemfile`. The behavior by itself is not the issue but it [does not play well with bundix](https://github.com/nix-community/bundix/pull/68).

#### The Fix

- Option 1: Manually strip the platform ids out of the lock file. Change `1.63.6-x86_64-linux-gnu` to `1.63.6`. Repeat for all other cases.
- Option 2: [Modify the config file](https://github.com/NixOS/nixpkgs/blob/master/doc/languages-frameworks/ruby.section.md#platform-specific-gems-ruby-platform-specif-gems). Running the command `bundle config set --local force_ruby_platform true` will add `BUNDLE_FORCE_RUBY_PLATFORM: "true"` to the bundle config file.
  - `rm gemset.nix; rm Gemfile.lock` to remove the old files and run `bundix -l` once again.
  - Now the `Gemfile.lock` will show `ruby` as the platform and the gem names will be fixed

Now lets run `nix-shell` once again.

## `sass-embedded`

It works right? No shot. This time we get a new error.

```console
fetch https://github.com/sass/dart-sass/releases/download/1.64.2/dart-sass-1.64.2-linux-x64.tar.gz
rake aborted!
SocketError: Failed to open TCP connection to github.com:443 (getaddrinfo: Temporary failure in name resolution)
```

I don't fully understand what the issue is, but Nix clearly does not like the gem attempting to download a tarball during its installation.

### The Quick Fix

[There is actually a pretty easy fix for this](https://technogothic.net/pages/JekyllOnNix/). We can simply downgrade Jekyll to version 4.2.2 which does not rely on `sass-embedded`.

```diff
- gem "jekyll"
+ gem "jekyll", "~> 4.2.2"
gem "kramdown"
gem "kramdown-parser-gfm"
```

### The Longer Fix

The same post points to a [Github issue discussing the problem](https://github.com/ntkme/sass-embedded-host-ruby/issues/102). Which suggests that you can pass in the location of a `tar.gz` file that contains `sass-embedded` as `SASS_EMBEDDED="path/to/tarball"`. So lets try that. I won't be getting deep into customizing gem setups because frankly I don't understand them, but we can modify our `shell.nix` to look like this.

```nix
# shell.nix
with (import <nixpkgs> { }); let
  env = bundlerEnv {
    name = "personal_site-bundler-env";
    inherit ruby;
    gemfile = ./Gemfile;
    lockfile = ./Gemfile.lock;
    gemset = ./gemset.nix;
    gemConfig = {
      sass-embedded = attrs: {
        SASS_EMBEDDED = pkgs.fetchurl {
          url = "https://github.com/sass/dart-sass/releases/download/1.64.2/dart-sass-1.64.2-linux-x64.tar.gz";
          sha256 = "";
        };
      };
    };
  };
in
stdenv.mkDerivation {
  name = "personal_site";
  buildInputs = [ env ];
}
```

This configuration will download the tarball to and provide the downloaded location to the `SASS_EMBEDDED` variable. Remember, all configuration values get passed as environment variables to the builder script.

You also might be wondering why `sha256 = ""`. At the moment we don't know what the SHA is. Nix will give us a SHA mismatch error later and we can get the SHA value then.

Lets run `nix-shell` again. Aaaaaand we get the same TCP error `SocketError: Failed to open TCP connection to github.com:443 (getaddrinfo: Temporary failure in name resolution)`. What gives?

#### Deeper Investigations

Upon looking into this closer I found that I was not the only one having these issues and people seemed to have come up with differing solutions. Including [using the above code](https://github.com/thomasjm/thomasjm.github.io/blob/3ea0b5061284c67b0345907445fdd7517ae8f498/flake.nix#L22), [applying a patch to the sass `Rakefile`](https://github.com/LumiGuide/nixpkgs/blob/3bb352892ece0d33d322135a9517fbfdfd27c7e9/pkgs/servers/web-apps/discourse/default.nix#L198), [applying a substitution](https://github.com/mayflower/nixpkgs/blob/b8346c214eeb087592d978a8538f8b3afbca70a4/pkgs/servers/web-apps/discourse/default.nix#L192), [downgrading Jekyll](https://github.com/joshrule/joshrule.github.com/blob/b497fd31ad4f471339684a015ad336b6044b4b3c/flake.nix#L40), [building their own derivation](https://github.com/lafrenierejm/nixpkgs/blob/54abe781c482f51ff4ff534ebaba77db5bd97442/pkgs/misc/dart-sass-embedded/default.nix#L8) or [using dart-sass directly](https://github.com/NixOS/nixpkgs/blob/b7471a83f427c2799fd47b8692445c31a330388e/pkgs/development/ruby-modules/gem-config/default.nix#L714).

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**How I found all that code**\\
> If you are wondering how I found all that code, it was simple. I used Github's code search. I simply limited by search to only `.nix` files with the filter `path:*.nix` and added the necessary words I was looking for: `sass-embedded`.

I tried a majority of these methods and could not get many to work. Part of the way that Nix works consistently is it locks in dependencies. So because I was a bit late to the party compared to when some of these people wrote the code for their fixes the source code had changed and I could not use those same fixes.

#### Exploring Source Code

Thus, I had to look into the actual `sass-embedded` `Rakefile` to find a solution.

```rb
# ext/sass/Rakefile
file 'dart-sass' do |t|
  raise if ENV.key?('DART_SASS')

  gem_install 'sass-embedded', SassConfig.gem_version, SassConfig.gem_platform do |dir|
    cp_r File.absolute_path("ext/sass/#{t.name}", dir), t.name
  end
rescue StandardError
  archive = fetch(ENV.fetch('DART_SASS') { SassConfig.default_dart_sass })
  unarchive archive
  rm archive
end
```

The code in question is above. We can see that what happened is pretty simple. At some point in time there might have been a check for the tarball at `SASS_EMBEDDED` but now the check is made at `DART_SASS`. Thankfully, it seems like our earlier code should work with just that small change (just swap `SASS_EMBEDDED` to `DART_SASS`). We run `nix-shell` once more and we should get a new error.

```console
error: hash mismatch in fixed-output derivation '/nix/store/vjpjz4f5dxhw11r1j903grkmpfl9jc7f-dart-sass-1.64.2-linux-x64.tar.gz.drv':
         specified: sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=
            got:    sha256-+RmtceWz5K2xaJZvuaJs31tocby4H/LwBBV15DRBCzs=
```

Finally, we can use this mismatched SHA to complete the working code.

#### It Works!

Just kidding. We have a new error.

```console
error: collision between `/nix/store/xrww8y53535zlxlik0bg4p0bgaja45yl-ruby3.1.4-sass-embedded-1.64.2/lib/ruby/gems/3.1.0/bin/sass' and `/nix/store/yj5c4036xb76m27b1vhb8k8nvj62anpm-ruby3.1.4-sass-3.7.4/lib/ruby/gems/3.1.0/bin/sass'
```

This is another quick fix. I don't understand the details, but basically you can only have one of the `sass` or `sass-embedded` as a dependency. `sass` and `sass-embedded` do the same stuff with `sass` being deprecated so we can simply remove `sass` from out `Gemfile` (don't forget `bundix -l` to update our files).

Or at least we can almost do that. Unfortunately, `uncss` relies on `sass`. But given they are interchangeable we can simple replace one for the other.

```diff
# uncss.rb
# frozen_string_literal: true

- require 'sass'
+ require 'sass-embedded'
require 'tempfile'
require 'json'
```

`nix-shell` once more. Success! We are finally in the Nix Shell.

## Nix Shell

Now that we are in the nix shell we can finally run Jekyll and get our site working: `bundle exec jekyll serve`.

### More Troubleshooting

And just like that something else breaks, this time `ruby-ffi`:

```console
bundler: failed to load command: jekyll (/nix/store/jymzy623gl7pacwlr730bp038kqgxbzd-personal_site-bundler-env/lib/ruby/gems/3.1.0/bin/jekyll)
/nix/store/9izdzmylrrpbiyic4ad9n380pbczkcjn-ruby3.1.4-ffi-1.15.5/lib/ruby/gems/3.1.0/gems/ffi-1.15.5/lib/ffi/library.rb:145:in `block in ffi_lib': Could not open library 'glib-2.0.so': glib-2.0.so: cannot open shared object file: No such file or directory. (LoadError)
Could not open library 'libglib-2.0.so': libglib-2.0.so: cannot open shared object file: No such file or directory
```

What exactly is happening here? `ruby-ffi` provides a way to interface with libraries on the system. If we look deeper we can find this code:

```rb
# lib/ffi/library.rb
# TODO better library lookup logic
 unless libname.start_with?("/") || FFI::Platform.windows?
	path = ['/usr/lib/','/usr/local/lib/','/opt/local/lib/', '/opt/homebrew/lib/'].find do |pth|
	  File.exist?(pth + libname)
	end
	if path
	  libname = path + libname
	  retry
	end
 end
```

We can see from the code that the gem is searching for the `glib`, `gobject` and `vips` libraries in the `/usr/` and `/opt/` directories which will not work with Nix. So what can we do?

### The Easy Fix

Nix already has a patched version of `ruby-vips` in its packages as `rubyPackages.ruby-vips`. However, `jekyll_picture_tag` is outdated and requires version 2.0.17 of the gem, which is not available with `nixpkgs`.

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Note on old packages**\\
> Technically the gem is actually available. We can use https://pkgs.on-nix.com/ to find the particular [commit in which the gem is still available](https://github.com/NixOS/nixpkgs/commit/074ef76e99b3d54ef4804bbc1f37122721cd2b18). Using that SHA and code from https://lazamar.co.uk/nix-versions/ we can use that old version of the gem. Unfortunately, the old version relies on other outdated gems so it simply is not feasible. But you can use old package versions if needed.

Thus, the easiest fix is simply to fork the gem and update the `.gemspec` to use a modern version of them gem.

```diff
# jekyll_picture_tag.gemspec

# ruby-vips interfaces with libvips
- spec.add_runtime_dependency 'ruby-vips', '~> 2.0.17'
+ spec.add_runtime_dependency 'ruby-vips', '~> 2.1.4'
```

Then you update the `Gemfile` with a call to your fork. From [the Bundler docs](https://bundler.io/guides/git.html) that call will look like:

```rb
# Gemfile
gem "jekyll_picture_tag", git: "https://github.com/user_name/repo_name"
```

### The Tougher Fix

The other solution is to essentially do exactly what the [Nix package for `ruby-vips` does under the hood](https://github.com/NixOS/nixpkgs/blob/0af35df7b8760d29f95119f131f1ef71da93003d/pkgs/development/ruby-modules/gem-config/default.nix#L575-L584).

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**`'` is not `"`**\\
> I am not sure if the `vips.rb` code has changed but the replace function in the Nix package code matches `"vips"` while the code has `'vips'`. The single or double quotes matter so make sure you have single quotes in your `shell.nix`.

Lets fix our `shell.nix`.

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
  buildInputs = [ env ];
}
```

Now all the calls to the `library_name` function that typically would search for the library are placed with a direct path to the library, so `ruby-vips` is happy.

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**A more detailed explanation of what is going on**\\
> As I mentioned earlier in the process of making the shell environment Nix will call [the script `setup.sh`](https://github.com/NixOS/nixpkgs/blob/master/pkgs/stdenv/generic/setup.sh). This script provides multiple built in functions that we see in the code above. [`postInstall` is a hook that Nix runs after the install phase](https://github.com/NixOS/nixpkgs/blob/master/pkgs/stdenv/generic/setup.sh#L1397). [Check this](https://nixos.org/manual/nixpkgs/stable/#sec-stdenv-phases) for a reference of all the phases. [Hooks in turn are just snippets of code that get called to be executed](https://github.com/NixOS/nixpkgs/blob/master/pkgs/stdenv/generic/setup.sh#L71) in a string representation.
> 
> As you might guess `substituteInPlace` is yet another [function provided by `setup.sh`](https://github.com/NixOS/nixpkgs/blob/master/pkgs/stdenv/generic/setup.sh#L914). It does exactly what you think. Other shell functions and utilities are described[in the Nix docs](https://nixos.org/manual/nixpkgs/stable/#ssec-stdenv-functions).

## Node and Node Packages

At this point we just have Node and Node packages to deal with. If you already have Node and `npm` you can just `npm install` and run the site. For the sake of this post we are going to cover all that as a shell integration. Lets start by just adding Node.

### NodeJS

We just add the node package as a build input to our derivation: `buildInputs = [env pkgs.nodejs ];`. `buildInputs` is not a function like before, instead it is an environment variable that Nix will loop over with `findInputs` to find all the needed build dependencies. It does so in an intelligent way to prevent pulling in dependencies multiple times ([you can read more about that process here](https://nixos.org/guides/nix-pills/basic-dependencies-and-hooks.html)).

Why dependencies are added in `buildInputs` instead of `dependencies`? I do not know.

The `nodejs` package includes both the V8 node server and `npm` so we can just run `npm install` **within** our shell at this point and the website will run.

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**Packaging Node Modules**\\
> If you are a real glutton for punishment you can package your node modules the same way that you packaged your gems. In my experience it is an even more cumbersome process that with Gems so I won't include that process in this post. But if you want to see how it is done I have made a very short post on how do it here.

## Final Code

Here is the final code if you just skipped to the end or you [can take a look at the code here.](https://github.com/elasticspoon/personal_site/blob/main/shell.nix)

```nix
# shell.nix
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
  # you may want to include pkgs.bundix if you want to mess with the gems more
  buildInputs = [ env pkgs.nodejs];
}
```

Fire it up with `nix-shell` then your usual Jekyll commands `bundle exec jekyll serve`, etc.

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Regarding other dependencies**\\
> Having written this code and you aren't going to be be making further modifications to the gems, you could remove further dependencies off your system. You could remove Bundix, Bundler and Ruby off your system completely. That said if you want to make changes to the gems you are going to need to add Bundix as a `buildInput` which means changing to `buildInputs = [ env pkgs.nodejs-slim pkgs.bundix ];`.
> 
> Even now I would not recommend trying to run all this as `--pure` because there are still dependencies that are missing from the derivation. It is too time consuming for me to try to find all of them so I am unwilling to try to make it work.

## Conclusions

Honestly, this whole process was an absolute pain in the ass. It is pretty crazy to me that I have to jump through so many hoops to basically run `bundle install` and have everything work. That said when the process for installing ruby is as simple as adding `system.packages = [ ruby ];` to my configuration I guess it makes sense that there might be issues in other areas. Nix is **not** beginner friendly but the concept of being able to have full system configuration that is completely portable and repeatable is a huge drawing point for this OS.

I felt like I learned a **ton** about Nix the OS, the package manager and the Nix language both in making my shell work and in writing this blog post. Even still the functional paradigms of this language make a lot of it pretty hard for me to follow.

```nix
callPackage = path: overrides:
  let f = import path;
  in f ((builtins.intersectAttrs (builtins.functionArgs f) allPkgs) // overrides);
```

This is the sort of code that is written in the Nix pills, a series of blog posts aimed to help you learn the Nix system. Without a pretty solid understanding of the language that code is very hard to follow. Given Nix has no penalties for creating more variables I don't see why it isn't more common to write more self-documenting code.

```nix
callPackage = path: configOverrides:
  let
    function = import path;
    usedPkgConfigs = builtins.intersectAttrs (builtins.functionArgs function) allPkgs;
    result = function (usedPkgConfigs // configOverrides);
  in
  result;
```

This code isn't perfect. The function part is still a bit unclear but at least to me is seems a lot more clear what the function actually ends up acting upon.
