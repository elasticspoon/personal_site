---
title: Tmux Session Auto-Saving using a Systemd Service
layout: post
subtitle: Exploring basic usages of systemd services
readtime: true
toc: true
tags:
  - nix
  - systemd
  - tmux
  - tmux-resurrect
  - tmux-continuum
summary: In this post I fix  issues with the `tmux-continuum` plugin when running `tmux` without a status line. I explore creating a `systemd` services and create one for automatic session saving. I provide both Home Manager and Nix Module approaches.
thumbnail-img: "assets/img/thumbnails/tmux-autosave.jpg"
---

# Setting Up a Service to Run [`tmux-continuum`](https://github.com/tmux-plugins/tmux-continuum) without a Status Line

[`tmux-continuum`](https://github.com/tmux-plugins/tmux-continuum) and its companion plugin, [`tmux-resurrect`](https://github.com/tmux-plugins/tmux-resurrect/), are invaluable tools for managing sessions in `tmux`. However, I recently encountered an issue where these plugins stopped working after I made some changes to my configuration.

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**Note on Nix and the Content of This Post**\\
> Please note that this post primarily addresses solutions using the Nix package manager to manage software. While I also provide more general solutions, they are not the main focus.

To provide some context, `tmux-resurrect` allows you to save and restore entire `tmux` sessions, while `tmux-continuum` automatically saves your sessions using `tmux-resurrect` and restores them on server startup. However, when I started my `tmux` server recently, I didn't get the expected recent state but instead an older one.

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Installing `tmux` Plugins with Nix**\\
> Home Manager simplifies the installation of `tmux` and additional plugins. Here's an example configuration snippet:

```nix
programs.tmux = {
  enable = true; # Enable the program
  plugins = with pkgs.tmuxPlugins; [
    # Enable a plugin with a set if you want to pass config options
    {
      plugin = tmux-thumbs;
      # ExtraConfig will just be added to your tmux.conf file
      # So, write all configurations the same way
      extraConfig = ''
      set -g @thumbs-key Space
      '';
    }
    # Enable a plugin by name if you aren't passing config options to it
    fuzzback
  ];
  extraConfig = builtins.readFile ./config; # Source additional configurations from a provided config file
};
```

So, what went wrong? The issue was that I had turned off my status line in `tmux`, and as a result, the `tmux-continuum` plugin stopped working.

## Problem: Running `tmux-continuum` with No Status Line

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**`tmux-continuum` vs. `tmux-resurrect`**\\
> While I've mainly discussed `tmux-continuum` because it has the functionality I wanted to fix, it's essentially a wrapper around `tmux-resurrect` with added utility, including a lock-file mechanism for saving and automatic server restoration. Ideally, all saving should happen by calling `continuum_save.sh`.

> Unfortunately, in my case, when `continuum_save.sh` tried to call `save.sh` from `tmux-resurrect`, it wouldn't work for some reason. I lacked the necessary troubleshooting knowledge to fix it, so I resorted to directly calling `tmux-resurrect`'s save script.

Let's first take a quick look at `tmux-resurrect` itself to understand the problem domain. Essentially, this plugin consists of a `.tmux` file and several helper scripts that it can invoke. The `resurrect.tmux` file is, in fact, a Bash script that you include in your `tmux` configuration.

```shell
$ > tree ../resurrect
# Full file path and some contents omitted
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
>**Why Does the Status Line Matter?**\\
> My understanding is that the only part of `tmux` that regularly refreshes and can be hooked into is the status line, which refreshes every 15 seconds. There are no other regularly executing hooks. Therefore, to make `tmux` execute the script at regular intervals, the plugin injects the save script into the status line. Every 15 seconds, the status line triggers the save command, which checks if enough time has passed since the last execution and then runs and updates a global config if necessary.

With no status line, the script won't execute on my system, so I had to explore other options. I considered various solutions from [a related GitHub issue](https://github.com/tmux-plugins/tmux-continuum/issues/99), including:

- Integrating session saving into the Bash prompt, but this wouldn't work well with Nix because the script path can vary.
- Creating aliases for commands that terminate a `tmux` session to include a call to the save script.
- Creating a `systemd` service to run in the background and auto-save on a timer, which seemed the most challenging.

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Adding Auto-Saving via Bash Prompt**\\
> You can add the following code to your `.bashrc`:
>
> ```sh
> precmd() {
>  if [ -n "$TMUX" ]; then
>    eval "$(tmux show-environment -s)"
>    eval "$($HOME/path/to/continuum/scripts/continuum_save.sh)"
>  fi
> }
> PROMPT_COMMAND=precmd
> ```

This code calls the save function every time your Bash prompt updates, ensuring the plugin's internal checks prevent excessive saving.

Given that I use Nix, the Bash prompt method was impractical. When using Nix to install `tmux-resurrect`, the script's path is not consistent, making it unsuitable for a Bash prompt solution. To address this, I decided to create a service.

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**Running `save.sh` Directly**\\
> Running `save.sh` directly poses an issue: if it's called when no `tmux` session is running, it saves an empty file. To overcome this, I wrote a short Bash script:

```shell
# scripts/tmux-save.sh
#!/usr/bin/env bash

if [ "$(pgrep tmux)" ] && [ "$RES_SAVE_PATH" ]; then
  $RES_SAVE_PATH quiet
fi
```

I used an environment variable, `RES_SAVE_PATH`, which the service will pass to the script.

## Systemd Services

In essence, any service consists of a `.service` file residing in the directory where `systemd` expects to find services. This directory can vary, but for user services, it's often `$HOME/.config/systemd/user/`.

You can create a minimal service file with just `ExecStart`, `ExecStop`, or `SuccessAction`:

```ini
# test-service.service
[Service]
ExecStart=/usr/bin/env bash -c "echo hello world"
```

You can test the service with `systemctl --user start test-service.service` and check its status.

```console
$ > systemctl --user status test-service.service
○ test-service.service
     Loaded: loaded (/home/bandito/.config/systemd/user/test-service.service; static)
     Active: inactive (dead)

Aug 17 18:56:30 desktop systemd[1625]: Started test-service.service.
Aug 17 18:56:30 desktop env[107387]: hello world
```

### Auto-Save Service

How should our auto-save service look?

```ini
# tmux-autosave.service
[Service]
ExecStart=bash path/to/save.sh
# Indicates that the service will run once then go inactive
Type=oneshot

[Unit]
Description=Run tmux save script every 15 minutes
OnFailure=error@%n.service
```

This service needs something to keep track of time and trigger it when needed: a timer.

```ini
# tmux-autosave.timer
[Install]
# Loads timers after system boots. Suggested target for most application timers.
# Other options often used are default.target or graphical.target, but those load earlier during the login shell.
WantedBy=timers.target

[Timer]
# The timer will start after 5 minutes on the first run.
OnBootSec=5min
# The timer will run every 15 minutes when the computer is active.
OnUnitActiveSec=15min
# It will activate the tmux-autosave.service unit.
Unit=tmux-autosave.service

[Unit]
Description=Run tmux save script every 15 minutes
```

Unfortunately, due to path issues, we can't conveniently call the save script with a `.service` file. We have to define these files directly in our Nix configuration. This leads to the choice of whether to define the service as a system or user service.

### Creating a Service in Nix

There are two types of services: system and user services. A computer has only one **system** service, which runs as long as the system is active. In contrast, a computer can have multiple **user** sessions. Since auto-saving `tmux` sessions is relevant only to my development environment as a user, it makes sense to keep it as a user service. Services like sound drivers or network cards are better suited for system-wide operation, as they apply to all users.

Having chosen to create a user service, we must decide whether to use a Nix module or Home Manager. Home Manager is preferable because it stores the file in a subdirectory of `$HOME/.config`, making it easier to access. Nevertheless, I'll provide examples for both options.

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

A couple of points to note: First, in the Nix language, when you specify a relative path or package in a string, Nix translates it into an absolute path. For instance, `${pkgs.bash}` becomes `/nix/store/p6dlr3skfhxpyphipg2bqnj52999banh-bash-5.2-p15/bin/sh` in the actual file.

Second, I added an environment variable, `RES_SAVE_PATH`, which uses Nix syntax to set the variable to the path of the `tmux-resurrect` save script.

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

The timer configuration is essentially identical, with minor syntax differences. You can find all the configuration options for services [here](https://search.nixos.org/options?channel=unstable&from=0&size=50&sort=relevance&type=packages&query=systemd.user.services.%3Cname%3E) and for timers [here](https://search.nixos.org/options?channel=unstable&from=0&size=50&sort=relevance&type=packages&query=systemd.user.timers.%3Cname%3E). One noteworthy addition is the `path` section. As per the [documentation](https://search.nixos.org/options?channel=unstable&show=systemd.user.services.%3Cname%3E.path&from=0&size=50&sort=relevance&type=packages&query=systemd.user.services.%3Cname%3E.path):

> Packages added to the service’s `PATH` environment variable. Both the `bin` and `sbin` subdirectories of each package are added.

Without this, the script wouldn't have access to commands like `tmux` or `basename`. Adding these packages to the path is essential for proper execution. The Home Manager version doesn't encounter the same issue because it has a different runtime environment (though the specifics are beyond my knowledge).

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**Viewing Service File Contents**\\
> To inspect the contents of these service files, you can use the `systemctl cat --user name_of_service.service` or `name_of_timer.timer` command.

### Running the Services

With the services set up, you can find the created files in `${HOME}/.config/sytemd/user`:

```console
$ > tree ~/.config/systemd/user/
~/.config/systemd/user/
├── timers.target.wants
│   └── tmux-autosave.timer -> /nix/store/ds3qmyw4hkw72ac40g1w13vfj9ahwg44-home-manager-files/.config/systemd/user/timers.target.wants/tmux-autosave.timer
├── tmux-autosave.service -> /nix/store/ds3qmyw4hkw72ac40g1w13vfj9ahwg44-home-manager-files/.config/systemd/user/tmux-autosave.service
└── tmux-autosave.timer -> /nix/store/ds3qmyw4hkw72ac40g1w13vfj9ahwg44-home-manager-files/.config/systemd/user/tmux-autosave.timer
```

You might wonder about the `timers.target.wants` directory. This directory and the symbolic link within it are created if you enable the timer using `systemctl --user enable tmux-autosave.timer`. It's part of the timer installation process, allowing the `timers.target` unit to know which services to start.

If you had

used `WantedBy=default.target` instead of `WantedBy=timers.target`, the installation would have created a `default.target.wants` directory with a symbolic link to the timer.

You can view the contents of the files Nix created using the `cat \path\to\service` command or, for more details, `systemctl cat service_name`.

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

At this point, you've fully set up your services. Services provide a versatile way to run scripts automatically, and you can use this capability for various tasks. For example, you can create services to periodically ping the databases of your hobby projects to prevent them from going inactive when on free plans.

While Nix itself doesn't bring anything special to services, it offers a more declarative approach. By letting Nix control the script's contents, you can be more declarative with your services. Even though you're still hard coding the script's location into the service, Nix ensures that the script will always be in that location.
