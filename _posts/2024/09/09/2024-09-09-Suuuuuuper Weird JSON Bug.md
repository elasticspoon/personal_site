---
layout: post
title: Suuuuuuper Weird JSON Bug
summary: I describe my debugging process when dealing with a strange JSON bug during a Rails 7.1 to 7.2 upgrade.
thumbnail-img: "assets/img/thumbnails/json-rails-bug.jpg"
readtime: true
toc: true
tags:
  - rspec
  - rails
  - ActiveSupport
  - ToJsonWithActiveSupportEncoder
---

# Suuuuuuper Weird JSON Bug

I was working on a Rails 7.1 to 7.2 upgrade this last week and ran into a particularly unexpected JSON bug. In this post I wanted to document my troubleshooting process.

Initially the bug manifested as failing system specs in CI with no clear connection between them, running the specs individually did not seem to trigger the issues. So I did what I usually do: ran `rspec --bisect` and went to walk my dog. By the time I came back I had a nice output of 20 order dependent failures and a command to replicate it.

## Datatables

The most telling (and first) failure looked like this:

```plaintext
1) /volunteers POST /datatable renders json data
     Failure/Error: expect(response.body).to eq data.to_json

       expected: "{\"recordsTotal\":51,\"recordsFiltered\":10,\"data\":[{},{},{},{},{},{},{},{},{},{}]}"
            got: "\"#[Double \\\"datatable\\\"]\""
```

The test itself is nothing special:

```rb
describe "POST /datatable" do
    let(:data) { { "some" => "data" } }

    before do
      allow(VolunteerDatatable).to receive(:new).and_return(double("datatable", as_json: data))
    end

    it "renders json data" do
      sign_in admin

      post datatable_volunteers_path
      expect(response.body).to eq data.to_json
    end
  end
end
```

And the code in question:

```rb
def datatable
  volunteers = get_volunteers
  datatable = VolunteerDatatable.new volunteers, params

  render json: datatable
end
```

The crux of the matter here is that `VolunteerDatatable` is an object that implements `as_json` which returns a hash representation of itself. When the call `render json: datatable` is made `VolunteerDatatable` [return itself as a JSON object, and sets the content type as `application/json`. If the object is not a string, it will be converted to JSON by calling to_json](https://apidock.com/rails/ActionController/Rendering/render).

`ActiveSupport` then provides a `to_json` that calls `as_json` on a object, to return a hash, then calls `to_s` on that hash to get back a string (or something along those lines).

To reiterate the method calls go `render json: datatable` => `datatable.to_json` => `datatable.as_json.to_s`

## Why Are We Failing?

A this point I am baffled. I was calling the same methods on the same objects and kept getting different results between rails versions. Where do I even go from here? How do I figure this out? I decided I wanted to see the full call stack and reached for the [`trace_location` gem](https://github.com/yhirano55/trace_location).

This let me do something like:

```rb
TraceLocation.trace(format: :log) do
  dt = double("datatable", as_json: data)
  allow(VolunteerDatatable).to receive(:new).and_return dt
  VolunteerDatatable.new(1, 2).to_json
end
```

Trace location essentially returns a [call stack looking output](https://github.com/yhirano55/trace_location/blob/master/examples/active_record_establish_connection/result.log) that shows what calls were made and where they returned. I ran the above trace on both versions of my code and I got these results.

On Rails 7.1:

```plaintext
C activesupport-7.1.3.4/lib/active_support/core_ext/object/json.rb:36 [ActiveSupport::ToJsonWithActiveSupportEncoder#to_json]
  C activesupport-7.1.3.4/lib/active_support/json/encoding.rb:22 [ActiveSupport::JSON.encode]
    ... other stuff
  R activesupport-7.1.3.4/lib/active_support/json/encoding.rb:24 [ActiveSupport::JSON.encode]
R activesupport-7.1.3.4/lib/active_support/core_ext/object/json.rb:44 [ActiveSupport::ToJsonWithActiveSupportEncoder#to_json]
```

On Rails 7.2:

```plaintext
C rspec-mocks-3.13.1/lib/rspec/mocks/test_double.rb:46 [RSpec::Mocks::TestDouble#to_s]
  C rspec-mocks-3.13.1/lib/rspec/mocks/test_double.rb:41 [RSpec::Mocks::TestDouble#inspect]
    ... other stuff
  R rspec-mocks-3.13.1/lib/rspec/mocks/test_double.rb:43 [RSpec::Mocks::TestDouble#inspect]
R rspec-mocks-3.13.1/lib/rspec/mocks/test_double.rb:48 [RSpec::Mocks::TestDouble#to_s]
```

## Useless Rabbit-hole: RSpec and ActiveSupport Source Code

Given that the error looked to be an issue with `TestDouble`, I spend way too much time looking over RSpec mock code to try and figure out if that was the culprit. In retrospect the mock repository basically did not have meaningful behavioral changes in months and that should have been a clue to not pursue that avenue.

I also looked into the source code of `ActiveSupport::ToJsonWithActiveSupportEncoder` to see if something had changed there, if a method got deprecated or something. No dice.

## `ActiveSupport::ToJsonWithActiveSupportEncoder`

The breakthrough came when I started searching about more generally about `ActiveSupport::ToJsonWithActiveSupportEncoder`. I stumbled on [this article about changes in ancestry order](https://dev.to/roharon/rails-core-classes-method-lookup-changes-a-deep-dive-into-include-vs-prepend-3c26). The basic crux of the matter is that [this rails PR](https://github.com/rails/rails/pull/51640) made a change several Ruby classes (including `Object`) to `include` the encoder instead of `prepend`ing the encoder. This resulted in a change in the ancestry order.

```rb
# Rail 7.1
RSpec::Mocks::MethodDouble.ancestors  #=>
[RSpec::Mocks::MethodDouble,
 ActiveSupport::Dependencies::RequireDependency,
 ActiveSupport::ToJsonWithActiveSupportEncoder, # before Object
 Object,
 FriendlyId::ObjectUtils,
 Delayed::MessageSending,
 ActiveSupport::Tryable,
 JSON::Ext::Generator::GeneratorMethods::Object,
 PP::ObjectMixin,
 Kernel,
 BasicObject]

# Rails 7.2:
RSpec::Mocks::MethodDouble.ancestors #=>
[RSpec::Mocks::MethodDouble,
 ActiveSupport::Dependencies::RequireDependency,
 Object,
 FriendlyId::ObjectUtils,
 Delayed::MessageSending,
 ActiveSupport::ToJsonWithActiveSupportEncoder, # after Object
 ActiveSupport::Tryable,
 JSON::Ext::Generator::GeneratorMethods::Object,
 PP::ObjectMixin,
 Kernel,
 BasicObject]
```

And if we look at the definitions of the `to_json` method on the data table objects we can see a similar thing.

```rb
# Rails 7.1
datatable.method(:to_json)
 => #<Method: ReimbursementDatatable(ActiveSupport::ToJsonWithActiveSupportEncoder)#to_json(options=...)>

# Rails 7.2
 datatable.method(:to_json)
 => #<Method: ReimbursementDatatable(Object)#to_json(*)>
```

## Huh?

Basically Ruby has a pretty simple process of method lookup: try to call the method on the given object, if that doesn't work try the parent, and repeat until you run out of parents. Going into this we had an assumption about how the methods should be called:

> To reiterate the method calls go `render json: datatable` => `datatable.to_json` => `datatable.as_json.to_s`

We were expecting the method lookup to go: try `datatable.to_json` => can't find it => try `datatable.superclass.to_json` => can't find it => repeat until you call `ActiveSupport::ToJsonWithActiveSupportEncoder.to_json`.

**BUT** the ancestry order has changed, so instead of the above what actually happened was: try `datatable.to_json` => can't find it => try `datatable.superclass.to_json` => can't find it => `Object.to_json` => found => calls `datatable.to_s`.

The place of the encoder changed in the hierarchy, thus, our call to `to_json` never made it to the `ActiveSupport::ToJsonWithActiveSupportEncoder.to_json` and instead it would end with a call to `Object.to_json`.

# That's Cool but How Do I Fix It?

I opted for the simplest fix that came to mind. Revert the behavior to pre-7.2 behavior. This can be done by adding `prepend ActiveSupport::ToJsonWithActiveSupportEncoder` in the relevant classes to fix the ancestry.

In the `double` the new order might look like:

```rb
RSpec::Mocks::MethodDouble.ancestors #=>
[ActiveSupport::ToJsonWithActiveSupportEncoder
 RSpec::Mocks::MethodDouble,
 ActiveSupport::Dependencies::RequireDependency,
 Object,
 FriendlyId::ObjectUtils,
 Delayed::MessageSending,
 ActiveSupport::Tryable,
 JSON::Ext::Generator::GeneratorMethods::Object,
 PP::ObjectMixin,
 Kernel,
 BasicObject]
```

Thus, the call `to_json` will properly get to the active support encoder.
