---
title: Making a Service to Run tmux-continuum with No Status Line
layout: post
subtitle: Exploring basic usages of systemd services
readtime: true
toc: true
tags: [nix, systemd, tmux, tmux-resurrect, tmux-continuum]
---

# Making a Service to Run [`tmux-continuum`](https://github.com/tmux-plugins/tmux-continuum) with No Status Line

[`tmux-continuum`](https://github.com/tmux-plugins/tmux-continuum) and its dependency [`tmux-resurrect`](https://github.com/tmux-plugins/tmux-resurrect/) are a pair of very useful session management plugins for `tmux`. I had been happily using them until some change I made to my configuration caused them to stop working.

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**Nix and the subject of this post**\\
> Bear in mind the majority of this post will look at how to fix the plugins from the perspective of someone that is using the Nix package manager to manage their software. I do still include more general solutions but they are not the primary focus.

To give a bit more background, `tmux-resurrect` is a plugin that enables the saving and subsequent loading of the totality of a session of your `tmux` server. `tmux-continuum` is a plugin for `tmux` that periodically auto-saves the server using `tmux-resurrect` and loads the latest save on server start. At some point in time, I loaded up my server and instead of getting the most recent state I had expected, I got a much older state.

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Installing `tmux` plugins with with Nix**\\
>  Home Manager makes it super easy to install `tmux` and additional plugins.
> 
> ```nix
> programs.tmux = {
>   enable = true; # enable the program
>   plugins = with pkgs.tmuxPlugins; [
>     # enable a plugin with a set if you want to pass config options
>     {
>       plugin = tmux-thumbs;
>       # extraConfig will just get added to your tmux.conf file
>       # so write all configurations the same way
>       extraConfig = ''
>       set -g @thumbs-key Space
>       '';
>     }
>     #enable a plugin by name if you aren't passing config options to it
>     fuzzback
>   ];
>   extraConfig = builtins.readFile ./config; # source additional configurations from a config file you provide
> };
> ```

So what exactly happened? Simply put I overlooked [this small part of the documentation](https://github.com/tmux-plugins/tmux-continuum#continuous-saving):

> **Continuous saving**
> This action starts automatically when the plugin is installed. **Note it requires the status line to be on** to run (since it uses a hook in status-right to run).

I had just turned off my status line, so suddenly the plugin broke.

## Problem: Running `tmux-continuum` with No Status Line

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**`tmux-continuum` vs `tmux-resurrect`**\\
> So far I have mainly been discussing `tmux-continuum` since it has the functionality that I am trying to fix on my system. In reality it is just a wrapper around `tmux-resurrect` that adds some nice utility including a lock-file when saving and automatic server restoration. Thus, ideally all saving happens by calling `continuum_save.sh`.
> 
> Unfortunately this is not an ideal world. For whatever reason in my eventual solution when `continuum_save.sh` tried to call `save.sh` from resurrect the call simply would not work. I do not have enough bash troubleshooting knowledge to fix it, so I just settle for calling `tmux-resurrect`'s save script directly.

Let first take a quick look at `tmux-resurrect` itself to understand the problem domain. Fundamentally, the plugin is just a `.tmux` file and a bunch of helper scripts that it can call. The `resurrect.tmux` file itself is actually just a bash script that you call within your `tmux` config.

```shell
$ > tree ../resurrect
# full file path and some contents omittted
../resurrect
├── resurrect.tmux
└── scripts
    ├── restore.sh
    ├── save.sh
    ├── helpers.sh
    ├── shared.sh
    └── variables.sh
```

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Why does the status line actually matter?**\\
> This my understanding of how it works I could be wrong. The only part of `tmux` that is regularly refreshing that one can hook into is the status line, which refreshes every 15 seconds. There are no other regularly executing hooks.
> 
> Thus, to make `tmux` execute the script on a regular interval the plugin injects the save script into the status line. Every 15 seconds the status line calls the save command. The save command saves the last time it executed into a global config variable. Every time it is called it checks if enough time passed since last execution. If it has it runs and updates the global config.

Thus, with no status line showing the script will not be executed on my system, so I had to look at other options. Many of them came by the way of [the Github issue on the topic](https://github.com/tmux-plugins/tmux-continuum/issues/99). I considered the following:

- Integrate session saving into the bash prompt. This is reasonable. I already have a custom prompt, thus, I would just need to call `save.sh` from the prompt
- Create aliases for the commands that terminate a `tmux` session to include a call to the save script first. For example: alias `poweroff` to call `save.sh` first
- Make a `systemd` service that will run in the background and auto-save on a timer. I have never made a service before, so this one seemed the most daunting

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Adding auto-saving via bash prompt**\\
> You can add the following to your `.bashrc`.
> 
> ```sh
> precmd() {
>   if [ -n "$TMUX" ]; then
>     eval "$(tmux show-environment -s)"
>     eval "$($HOME/path/to/continuum/scripts/continuum_save.sh)"
>   fi
> }
> PROMPT_COMMAND=precmd
> ```
> 
> This will call the save function every time your bash prompt updates (which should be often). The plugin will still provide the internal checks on if you wrote too recently so you aren't saving too often.

Given that I am running Nix, this method will not work. If you use Nix to install `tmux-resurrect` instead of having some nice consistent path for `save.sh` you have something like `/nix/store/dmy3nqasx8dixz5hyllzhbdri8n4n1sa-tmuxplugin-resurrect-unstable-2022-01-25/share/tmux-plugins/resurrect/scripts/save.sh`.

Nix provides a convenient way to deal with that, we can call `${pkgs.tmuxPlugins.resurrect}` in a nix file to get that base file path for the script and work from there. However, therein lies the issue, the call must be made in a `.nix` file. Outsourcing that call to a bash file means that you need some other way to get that path.

Thus, we must create a service.

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**Running `save.sh` directly**\\
> An issue that occurs running `save.sh` directly is if it gets called when no `tmux` is running it will save an empty file. Thus, I had to write a very short bash script to get around this.
> 
> ```shell
> # scripts/tmux-save.sh
> #!/usr/bin/env bash
> 
> if [ "$(pgrep tmux)" ] && [ "$RES_SAVE_PATH" ]; then
>   $RES_SAVE_PATH quiet
> fi 
> ```
> 
> You will see in a bit, but the `RES_SAVE_PATH` will get passing in as an environment variable from the service.

## `systemd` Services

Fundamentally, any service is just a `.service` file that lives in the directory that `systemd` expects to find services in. What does that mean? Let's say `systemd` expects to find my user services (I will explain these later) in `$HOME/.config/systemd/user/`.

That means I can create a file `test-service.service` with minimal requirements: an `ExecStart`, `ExecStop`, or `SuccessAction`.

```ini
# test-service.service
[Service]
ExecStart=/usr/bin/env bash -c "echo hello world"
```

We can then test the service by running `systemctl --user start test-service.service` and look at the status.

```console
$ > systemctl --user status test-service.service
○ test-service.service
     Loaded: loaded (/home/bandito/.config/systemd/user/test-service.service; static)
     Active: inactive (dead)

Aug 17 18:56:30 desktop systemd[1625]: Started test-service.service.
Aug 17 18:56:30 desktop env[107387]: hello world
```

### Auto-Save Service

So how should our auto-save service look?

```ini
# tmux-autosave.service
[Service]
ExecStart=bash path/to/save.sh
# indicates that the service will run once then go inactive
Type=oneshot

[Unit]
Description=Run tmux save script every 15 minutes
OnFailure=error@%n.service
```

And this service is going to need something to actually keep track of time and call it when needed. A timer.

```ini
# tmux-autosave.timer
[Install]
# loads timers after system boots. suggested target for most application timers
# other options often used at default.target or graphical.target but those happen earlier at the login shell
WantedBy=timers.target

[Timer]
# First run of the timer will start after 5 mins
OnBootSec=5min
# Timer will run every 15 mins that the computer is active
OnUnitActiveSec=15min
# It will activate the tmux-autosave.service unit
Unit=tmux-autosave.service

[Unit]
Description=Run tmux save script every 15 minutes
```

Unfortunately, due to path issues there is no convenient way for us to call the save script with a `.service` file. We are going to have to define these files directly in our Nix configuration. Which brings us to the following choice. Do we want to define the service as a system or user service?

### Creating a Service on Nix

Technically, there are two kinds of services: system and user services. A computer will only have one **system** service, this will run the entire time the system is active. On the other hand, a computer can have multiple **user** sessions. Thus, given auto-saving `tmux` is something I only care about as a user on my development environment, it makes sense to keep it a user service. On the other hand, a service for a sound driver or a network card makes much more sense to run system-wide since it is applicable to all users.

That said, having chosen to create a user service, we still must decide if you want the service as a nix module or with Home Manager. I find the Home Manager option nicer because the file will be stored in a subdirectory of `$HOME/.config` which is easier to access. That said, I will provide examples of both options.

#### Home Manager:

```nix
systemd.user.services.tmux-autosave = {
    Unit = {
    Description = "Run tmux_resurrect save script every 15 minutes";
    OnFailure = "error@%n.service";
  };
  Service = {
    Type = "oneshot";
    Environment = [
      "RES_SAVE_PATH=${pkgs.tmuxPlugins.resurrect}/share/tmux-plugins/resurrect/scripts/save.sh"
    ];
    ExecStart = "${pkgs.bash}/bin/sh ${./scripts/tmux-save}";
  };
};
systemd.user.timers.tmux-autosave = {
  Unit = {
    Description = "Run tmux_resurrect save script every 15 minutes";
  };
  Timer = {
    OnBootSec = "5min";
    OnUnitActiveSec = "15min";
    Unit = "tmux-autosave.service";
  };
  Install = {
    WantedBy = [ "timers.target" ];
  };
};
```

There a couple of parts worth noting. First is a feature of the Nix language, when you have a string and you call a relative path or a package Nix will translate that to an absolute path. So when I call `${pkgs.bash}` it ends up being `/nix/store/p6dlr3skfhxpyphipg2bqnj52999banh-bash-5.2-p15/bin/sh` in the actual file.

The second thing to note is that I added an environment variable. Again, this uses the Nix syntax to set the variable `RES_SAVE_PATH` to the path of the `tmux-resurrect` save script.

#### Nix Module:

```nix
systemd.user.timers.tmux-save = {
  wantedBy = [ "timers.target" ];
  timerConfig = {
    OnBootSec = "5min";
    OnUnitActiveSec = "15min";
    Unit = "tmux-save.service";
  };
  description = "Save tmux sessions";
  onFailure = [ "error@%n.service" ];
};

systemd.user.services.tmux-save = {
  script = ''
    ${pkgs.bash}/bin/sh ${./scripts/tmux-save}
  '';
  description = "Save tmux sessions";
  environment = {
    RES_SAVE_PATH = "{pkgs.tmuxPlugins.resurrect}/share/tmux-plugins/resurrect/scripts/save.sh";
};

serviceConfig = {
  Type = "oneshot";
};

path = with pkgs; [ tmux toybox ];
};
```

The configuration for the timer is basically identical with minor syntax changes. You can find all the configuration options for services [here](https://search.nixos.org/options?channel=unstable&from=0&size=50&sort=relevance&type=packages&query=systemd.user.services.%3Cname%3E) and for timers [here](https://search.nixos.org/options?channel=unstable&from=0&size=50&sort=relevance&type=packages&query=systemd.user.timers.%3Cname%3E). The one thing of note is the addition of `path`. [From the documentation](https://search.nixos.org/options?channel=unstable&show=systemd.user.services.%3Cname%3E.path&from=0&size=50&sort=relevance&type=packages&query=systemd.user.services.%3Cname%3E.path):

> Packages added to the service’s `PATH` environment variable. Both the `bin` and `sbin` subdirectories of each package are added.

If you try running the service without this call, you will quickly notice that the script cannot make a call to `tmux` or to `basename` without those packages being in its path. Thus, we need to add them. The Home Manager version does not have the same issue because it has a different run time environment (how it differs I really don't know).

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Service File contents**\\
> If you are interested in what the contents of these service files actually look like there is a handy command `systemctl cat --user name_of_service.service` or `name_of_timer.timer`

### Running the Services

Having set up the services, we can now look in `${HOME}/.config/sytemd/user` and we will see our created files:

```console
$ > tree ~/.config/systemd/user/
~/.config/systemd/user/
├── timers.target.wants
│   └── tmux-autosave.timer -> /nix/store/ds3qmyw4hkw72ac40g1w13vfj9ahwg44-home-manager-files/.config/systemd/user/timers.target.wants/tmux-autosave.timer
├── tmux-autosave.service -> /nix/store/ds3qmyw4hkw72ac40g1w13vfj9ahwg44-home-manager-files/.config/systemd/user/tmux-autosave.service
└── tmux-autosave.timer -> /nix/store/ds3qmyw4hkw72ac40g1w13vfj9ahwg44-home-manager-files/.config/systemd/user/tmux-autosave.timer
```

You might be wondering about the `timers.target.wants` directory. That same symbolic link and directory would be created if we had had the initial timer file and ran `systemctl --user enable tmux-autosave.timer`. It is part of the installation process of the timers and the symbolic link is a way for the special `timers.target` unit to know what services it needs to start when it comes online.

If instead of having `WantedBy=timers.target` we had `WantedBy=default.target` the installation would have created a directory `default.target.wants` that would have a symbolic link to the same timer.

We can also look at the files that Nix created for use with a simple `cat \path\to\service` command or to get more fancy `systemctl cat service_name`.

```console
$ > cat ~/.config/systemd/user/tmux-autosave.timer
# The Timer
[Install]
WantedBy=timers.target

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
Unit=tmux-autosave.service

[Unit]
Description=Run tmux_resurrect save script every 15 minutes

$ > systemctl cat --user tmux-autosave.service
# The Service
[Service]
ExecStart=/nix/store/p6dlr3skfhxpyphipg2bqnj52999banh-bash-5.2-p15/bin/sh /nix/store/dmy3nqasx8dixz5hyllzhbdri8n4n1sa-tmuxplugin-resurrect-unstable-2022-05-01/share/tmux-plugins/resurrect/scripts/save.sh quiet
Type=oneshot

[Unit]
Description=Run tmux_resurrect save script every 15 minutes
```

At this point, we have fully set up our services. That said, the timers will not automatically run. `timers.target` either loads on the system booting or you can start your specific timer with `systemctl --user start name-of-timer.timer`.

## Conclusion

This activity has given me a ton of ideas about potential stuff that I can do with services. I am considering making some services to ping the databases of some of my hobby projects to ensure that they do not go inactive (since they are on free plans).

The versatility of having bash scripts that run automatically is tremendous.

Nix itself doesn't really bring anything too special to services. It does provide an option of being somewhat more declarative. If you have the script controlled (as in Nix writes the contents of the script to the script file) by Nix, you can be more declarative with your services. While you are still hard coding the location of a script into the service, Nix ensures that the script will always be in that location.
