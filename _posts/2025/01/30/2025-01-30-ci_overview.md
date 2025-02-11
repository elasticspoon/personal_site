---
layout: post
title: "Github Actions CI"
summary: An introduction to how we run CI at my company for 25 Rails apps on Github Actions using Docker Compose.
cover-img: /assets/img/thumbnails/delayed_job.jpg
thumbnail-img: /assets/img/thumbnails/delayed_job.jpg
share-img: /assets/img/thumbnails/delayed_job.jpg
readtime: true
toc: true
tags:
  - rails
  - ruby
  - continuous-integration
  - github-actions
---

# Deploying and providing CI for 25 Rails Apps

{: .box-warning .ignore-blockquote }

<!-- prettier-ignore -->
>**On the code you see**\\
> The code you see here may or may not work. It is largely taken from memory because I am not allowed to share my companies code.

## Brief Background

I work on something similar to a "platform" team for 130 Ruby on Rails developers. We run and provide CI (via self-hosted Github Actions) for the applications that other developers build.

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**A bit more background**\\
> To go a bit more in depth all the compute is handled by several Kubernetes clusters and the actual code lives in multiple repositories all under the same organization. Thus, a lot of the challenges we face are around providing flexibility for our developers without implementation details leaking out to them.

Our apps all follow a fairly similar pattern:

- they have a `Dockerfile`
- get built as an image
- get served via Kubernetes.

However, despite serving everything as containers our developers don't actually develop in containers. So to avoid the issue where production is the first place that our apps see containerized use we run all our tests in containers.

## How Do We Run CI?

Basically all our apps have a structure like so:

```plaintext
.
├── .github
│   └── workflows
│      └── main.yaml
├── Dockerfile
├── bin
│   ├── ci-some-command
│   └── ci-some-other-command
└── docker-compose.test.yaml
```

The `Dockerfile` is nothing worth mentioning, it just sets up our application with whatever dependencies it needs (gems, node modules, etc).

The scripts in `bin` as just basic bash scripts that represent the testing process, linting process or whatever. For example:

```bash
# bin/ci-lint
yarn lint
bundle exec brakeman
bundle exec rubocop
```

The idea is that these are the same scripts that a developer could run locally on their machine as in CI.

The `docker-compose` looks something like this:

```yaml
services:
  app:
    build:
      context: .
    image: app

  test:
    image: app
    command: "bin/ci-some-command"
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 1s
      timeout: 5s
      retries: 5
```

Running `docker compose up` locally builds the image, starts Postgres, then runs the `command` in a container.

This translates nicely to CI because the developers are able create arbitrary scripts and those scripts will run in CI the same way as locally. For example if a particular app wants to use Cypress they can add that to the existing script or create a new script for it.

## Getting It All Set Up in Github Actions

So how does this all look as an actions workflow?
{% raw  %}

```yaml
jobs:
  test:
    steps:
      - name: Checkout the repository
        uses: actions/checkout@v4

      - name: Login to DockerHub
        uses: docker/login-action@v3
        with:
          username: ${{ vars.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Set up Docker Buildx (to allow building a multiarch image)
        uses: docker/setup-buildx-action@v3

      - name: Set up build config
        uses: docker/bake-action@v5
        with:
          pull: true
          load: true
          files: docker-compose.test.yaml

      - name: Test
        id: run_tests
        env:
          DOCKER_RUN_CMD: ${{ inputs.docker-command }}
        shell: sh
        run: |
          docker compose -f docker-compose.test.yaml \
            run --rm "rails-test" "$DOCKER_RUN_CMD"

      - name: RSpec Report
        if: ${{ !cancelled() }}
        uses: our_org/actions/ruby-rspec-report@v4
```

Largely it looks something like:

1. we pull down the repo
2. set up docker
3. run the test in docker compose
4. print a report.

```yaml
- name: Test
  id: run_tests
  env:
    DOCKER_RUN_CMD: ${{ inputs.docker-command }}
  shell: sh
  run: |
    docker compose -f docker-compose.test.yaml \
      run --rm "rails-test" "$DOCKER_RUN_CMD"
```

{% endraw %}

The `DOCKER_RUN_CMD` here is simply to all passing in commands to run other `bin` scripts (ex: `bin/ci-lint` and `bin/ci-rspec`). I omitted showing the potential inputs that this action might receive.

## Benefits and Drawbacks

### Benefits

The biggest benefit of this approach (and the one that makes it pretty much mandatory) is that our applications see containerized usage before landing in some higher environment (staging, qa, etc). The majority of our developers simply don't develop in docker, this, given that the final product is served in a container, testing in docker is the next best thing.

Since our testing happens by starting docker compose and running a bash script with test commands the entire process is very platform agnostic. We don't have to worry about how do you set up ruby on GitHub Actions vs Jenkins vs CircleCI, then repeat for node, etc. We set up docker and that's it.

### Drawbacks

The main drawback (and I mean pure drawback not tradeoff) is performance overhead. This comes in two forms: container overhead and time to build the container.

In terms of the container overhead, running software directly in the runner will always be faster than running it with docker compose on the runner. Does it really matter? Not really.

The real problem we have encountered is the slow speed in building the images. The P90 of the setup step is 15 minutes on our biggest app (when all the layers miss the cache). Fixing this is still a work in progress.

### Shifted Complexity

We have moved the complexity around within the actions jobs. Without docker there might be complexity in ensuring all required packages are present to test the app. With docker you get that for free but instead you have to worry about setting up and building the image. This made sense for us.

## Conclusion

I left a lot of the detail out of my summary but we have about 25 web apps under us of varying sizes that we support this way. Beyond the initial setup the files in each app repository stay fairly static and developers largely get to ignore them. CI usually just works.

That was a super brief overview of our CI and in a future post I will go a bit more in depth on how we provide a few cool features namely:

- variably size parallelization of runs via input: `runner-count: 8`
- providing arbitrary commands to get run via CI: `[{"cmd": "some-command"}]`
- doing all of the above with SimpleCov and the `parallel_test` gem
