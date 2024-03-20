---
layout: post
title: "Random Tidbit: Delayed Job Queues"
summary: I recently added named queues to a Rails  I was working on using the Delayed Job gem. There were a few small hiccups that I wanted to share.some summary
cover-img: /assets/img/thumbnails/delayed_job.jpg
thumbnail-img: /assets/img/thumbnails/delayed_job.jpg
share-img: /assets/img/thumbnails/delayed_job.jpg
readtime: true
toc: true
tags:
  - rails
  - ruby
  - testing
  - delayed_job
---

# Random Tidbit: Delayed Job Queues

I recently added named queues to a Rails I was working on using the Delayed Job gem. There were a few small hiccups that I wanted to share.

## Why Named Queues?

This application primarily used jobs to send email notifications. Most of these email notifications had a similar priority, however, there was one other job: a data caching job. For unclear reasons, the application encountered issues with thousands of this job filling up the queue and not allowing notifications to be sent. Thus, we wanted to add a dedicated low-priority queue for caching.

## Delayed Job and Named Queues

Delayed Job makes the setup pretty simple.

- For Mailers: you can call `queue_as "queue_name"` at a class level.
- For Jobs: you can define `queue_name = "name_of_queue"` also at a class level.
- For Queues: in `config/initializers/delayed_job.rb`, you can set a priority:

```rb
# config/initializers/delayed_job
      .with(org_id: organization.id, type: type)
      .on_queue("low_priority").rb
Delayed::Worker.queue_attributes = {
  "queue_name" => { priority: -10 }, #this is high prio
  "name_of_queue" => { priority: 10 } # low prio
}
#optional lets you change default queue as well
Delayed::Worker.default_queue_name = "name_of_queue"
```

Those values can also be overridden if needed with `object.delay(:queue => 'high_priority', priority: 0).method`.

## Footguns

There were a few issues I ran into, and most of them were related to testing the job I modified.

### Issue 1: Naming

My goal was to have a test that enqueued the job and tested that it got the right inputs. The test helper would not work if I used a symbol:

```rb
#jobs/job.rb
class SomeJob
  def queue_name = :some_name
end

expect { job }.to have_enqueued_job(described_class)
      .with(stuff).on_queue(:some_name) # does not work
expect { job }.to have_enqueued_job(described_class)
      .with(stuff).on_queue("some_name") #neither does this
```

Instead, I had to use strings:

```rb
#jobs/job.rb
class SomeJob
  def queue_name = "some_name"
end

expect { job }.to have_enqueued_job(described_class)
      .with(stuff).on_queue("some_name")
```

### Issue 2: Testing Priority

One of the things I really wanted in my tests was simply to sanity check that the priority I created was actually being followed. I wanted to do something like: enqueue several low-priority tasks then enqueue a high-priority task. I would expect the high-priority one to execute before all the low-priority ones.

This resulted in several issues. The most fundamental being that job tests don't actually give you a way to check the order in which your jobs executed.

```rb
expect { job }.to have_enqueued_job(described_class)
      .with(stuff).on_queue("some_name").priority(value)
```

In theory, the above test should pass; however, all the jobs I had would enqueue with `nil` for the priority. How come?

#### Queue Adapter

In the Delayed Job code, we can see that priority is set when the job is queued, that is when it is written to the database table "delayed_job_queue".

```rb
#called in JobPreparer.prepare
def set_queue_name
  if options[:queue].nil? && options[:payload_object].respond_to?(:queue_name)
    options[:queue] = options[:payload_object].queue_name
  else
    options[:queue] ||= Delayed::Worker.default_queue_name
  end
end

# base.rb
def enqueue(*args)
  job_options = Delayed::Backend::JobPreparer.new(*args).prepare
  enqueue_job(job_options)
end
```

`ActiveJob::TestHelper` overrides the `queue_adapter` from `delayed_job` to the `ActiveJob` adapter. The enqueue for delayed job is never called, so the priority never gets set from the queue in tests. So if we test: `assert_enqueued_with(priority: some_value)` it will always fail.

#### What Do?

Just to sanity check the behavior, I ran the following code in `rails c`:

```rb
5.times { |i|  HistoricalDataCacheJob.perform_later(org_id: Organization.last.id, type: i) }
NotifyPartnerJob.perform_later(Request.last.id)
```

This creates several low-priority caching jobs first, then a notification job. The desired outcome is that the caching job is given a lower priority and the notifications occur before the caching.

DataCache Jobs were correctly set with the low priority:

```sh
# Lots of stuff ommited for berevity
  Delayed::Backend::ActiveRecord::Job Create (0.6ms)  INSERT INTO "delayed_jobs" ("priority", "queue") VALUES ($1, $2) RETURNING "id"  [["priority", 10],  ["handler", "--- !ruby/object:ActiveJob::QueueAdapters::DelayedJobAdapter::JobWrapper queue_name: low_priority\n  priority:\n"] ]
  TRANSACTION (2.2ms)  COMMIT
```

NotifyPartnerJob correctly fired off before the caching jobs despite being queued later:

```sh
16:55:06 worker.1 | [Worker(host:laptop pid:1071210)] Job NotifyPartnerJob [feac18aa-5d43-464a-9ff4-9ab1a238a027] from DelayedJob(default) with arguments: [200] (id=37) (queue=default) RUNNING
16:55:09 worker.1 | 2024-03-17T16:55:09-0400: [Worker(host:laptop pid:1071210)] Job HistoricalDataCacheJob [38641404-f54d-4b02-8b64-749271c6a6e7] from DelayedJob(low_priority) with arguments: [{"org_id"=>2, "type"=>"0", "_aj_ruby2_keywords"=>["org_id", "type"]}] (id=32) (queue=low_priority) RUNNING
```

## Conclusion

Delayed Job makes it super easy to set up named queues. In testing, the Delayed Job adapter is essentially mocked by a helper which results in different behavior. Make sure you keep this in mind. I did not find a direct solution to delayed job, but at the same time, I am not sure it is needed.
