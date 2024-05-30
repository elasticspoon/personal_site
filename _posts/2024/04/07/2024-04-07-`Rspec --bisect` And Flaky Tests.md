---
layout: post
title: RSpec --bisect And Flaky Tests
summary: A story about RSpec test flakiness stemming from order dependent issues and using RSpec `--bisect` to diagnose the issue.
thumbnail-img: "assets/img/thumbnails/rspec-bisect.jpg"
readtime: true
toc: true
tags:
  - "#ruby"
  - rspec
  - "#testing"
---

# `Rspec --bisect` And Flaky Tests

A few months ago I watched [this talk](https://www.youtube.com/watch?v=zsGloAjneX0) on flaky tests at RubyConf by Alan Ridlehoover. I watched it found it, found it interesting but thought to myself: "That's great, but **I** don't have those issues, my flakiness is just systems tests being systems tests".

## The Flaky Test

That was until I encountered some flakiness with the following test. Now an experienced rails developer might look at this and immediately be able to see the issue, alas, that was not me.

```rb
it "should return a full diff" do
    aggregate = EventTypes::Inventory.new(
      storage_locations: {
        storage_location1.id => EventTypes::EventStorageLocation.new(
          id: storage_location1.id,
          items: {}
        ),
        # missing storage_location2; this adds storage location that doesn't exist
        StorageLocation.count + 1 => EventTypes::EventStorageLocation.new(
          id: StorageLocation.count + 1,
          items: {}
        )
      }
    )
    results = EventDiffer.check_difference(aggregate)
    expect(results.as_json).to contain_exactly(some_specific_hash)
  end
```

Initially I could not replicate the issue, I tried running just that test withe the failing seed, I tried running the full codebase with the failing seed, nothing worked. But this day I was feeling particularly inspired and I just decided to trust in the conference talk. Alan states that there are three causes of flaky tests: non-determinism, order dependence and race conditions.

The first two typically have a fairly similar cause which is some form of global state. This part of the application did not make sense to have a race condition, so I felt it necessary to find what was causing that global state. But how can I do this? I can't even reproduce the issue.

### Finding the Culprit

The crux of the matter was a bit of an oversight on my part. When our spec tests were being run in CI they were actually getting split up and run in parallel across several Github actions.

If the full spec is `rspec "spec1" "spec2" "spec3"`, we have an action running `rspec "spec1" "spec2"` and another `rspec "spec3"`. Thus, neither `rspec` nor `rspec "spec2"` would catch a flaky test in `spec2`.

I needed to run specifically the failing subset `rspec "spec1" "spec2" --seed 123`. At this point in time it was `rspec --bisect` to the rescue.

## RSpec Bisect

The [RSpec docs](https://rspec.info/features/3-12/rspec-core/command-line/bisect/) do a get job explaining the `--bisect` command.

> Pass the `--bisect` option (in addition to `--seed` and any other options) and RSpec will repeatedly run subsets of your suite in order to isolate the minimal set of examples that reproduce the same failures.

If you have a spec or set of specs that fail with a certain seed `rspec --seed 123` running bisect of isolate the minimal example looks something like this:

```console
Bisect started using options: "--seed 1234"
Running suite to find failures... (0.16755 seconds)
Starting bisect with 1 failing example and 9 non-failing examples.
Checking that failure(s) are order-dependent... failure appears to be order-dependent

Round 1: bisecting over non-failing examples 1-9 .. ignoring examples 6-9 (0.30166 seconds)
Round 2: bisecting over non-failing examples 1-5 .. ignoring examples 4-5 (0.30306 seconds)
Round 3: bisecting over non-failing examples 1-3 .. ignoring example 3 (0.33292 seconds)
Round 4: bisecting over non-failing examples 1-2 . ignoring example 1 (0.16476 seconds)
Bisect complete! Reduced necessary non-failing examples from 9 to 1 in 1.26 seconds.

The minimal reproduction command is:
  rspec ./spec/spec_1_spec.rb[1:1] ./spec/spec_2_spec.rb[1:1] --seed 1234
```

Now you can run `rspec ./spec/spec_1_spec.rb[1:1] ./spec/spec_2_spec.rb[1:1] --seed 1234` to reproduce the flaky failure and fix it.

## Finding the Bad Assumption

With a minimal reproducible command I turned to pry debugging to determine how the test state differed between a passing and failing run. Let quickly remind ourselves of the flaky test code.

```rb
it "should return a full diff" do
    aggregate = EventTypes::Inventory.new(
      storage_locations: {
        storage_location1.id => EventTypes::EventStorageLocation.new(
          id: storage_location1.id,
          items: {}
        ),
        # missing storage_location2; this adds storage location that doesn't exist
        StorageLocation.count + 1 => EventTypes::EventStorageLocation.new(
          id: StorageLocation.count + 1,
          items: {}
        )
      }
    )
    results = EventDiffer.check_difference(aggregate)
    expect(results.as_json).to contain_exactly(some_specific_hash)
  end
```

The idea in this test is that there are say 2 storage locations: `location_one.id == 1` and `location_two.id == 2`. Thus, `StorageLocation.count == 2` and `location_three.id == 3` will not exist.

```rb
storage_locations: {
   1 => EventTypes::EventStorageLocation.new(
    id: 1
    items: {}
  ),
  2 => EventTypes::EventStorageLocation.new(
    id: 2,
    items: {}
  )
}
```

However, what if there were previously storage locations in the database that got removed? Then the ids of the storage locations might not start at 1, instead it might be `location_one.id = 2`.

But there will still only be 2 storage locations, in that case `count + 1` will override an existing location and the test will fail.

```rb
storage_locations: {
  2 => EventTypes::EventStorageLocation.new(
    id: 2
    items: {}
  ),
  2 => EventTypes::EventStorageLocation.new(
    id: 2,
    items: {}
  )
}
```

In the invalid case the output is a hash with only 1 item since setting 2 items to the same key in a hash just causes one to overwrite the other.

```rb
storage_locations: {
  2 => EventTypes::EventStorageLocation.new(
    id: 2
    items: {}
  ),
}
```

But why is this happening? We make a bad assumption about the state of the test when we create the items.

```rb
StorageLocation.count + 1 => EventTypes::EventStorageLocation.new(
  id: StorageLocation.count + 1,
  items: {}
)
```

## The Fix

To fix it just use a value for the `storage_location.id` that can never exist: `0`. In ActiveRecord you can never have an item with an Id of 0.

```rb
it "should return a full diff" do
    aggregate = EventTypes::Inventory.new(
      storage_locations: {
        storage_location1.id => EventTypes::EventStorageLocation.new(
          id: storage_location1.id,
          items: {}
        ),
        # missing storage_location2; this adds storage location that doesn't exist
        0 => EventTypes::EventStorageLocation.new(
          id: 0,
          items: {}
        )
      }
    )
    results = EventDiffer.check_difference(aggregate)
    expect(results.as_json).to contain_exactly(some_specific_hash)
  end
```

A bit anticlimactic, but that's the nature of flaky tests. They are often caused by small oversights in the code that are hard to catch without the right tools.
