---
layout: post
title: "Deep Dive: Ruby Procs, Blocks and Lambdas"
readtime: true
toc: true
tags: [ruby, blocks, procs, lambdas]
---

# Deep Dive: Ruby Procs, Blocks and Lambdas

Lets start with the most basic statement of how procs, blocks and lambdas related to one another. The Venn diagram below provides a quick illustration. In essence the term or class `Proc` encompasses both blocks and lambdas, however, both lambdas and blocks are different from one another.

{% include picture_tag.html src="procs_lambdas_blocks_comparison.png" alt="A Venn Diagram depicting the relationship between procs, blocks and lambda. Procs encompass both blocks and lamdas. Block and lambdas do not overlap eachother." %}

Defining those concepts alone doesn't really do much. So lets explore them in a more code focused manner. I will start will blocks because I find them to be the easiest to explain.

## Blocks

**A block is a way to pass behavior rather than data to a method.**

What exactly does that mean? Basically, instead of giving a method of a direct values `method(some_value)` you give the method a behavior `method { #some behavior }`. One might say you are passing a _block_
of behavior.

Blocks come in two forms:

```ruby
some_method { puts 'behavior being passed to method' }
# or
some_method do
	puts 'behavior but in a do/end block'
end
```

I should at this point note that although the goal of blocks is to pass behavior that does not mean that they cannot pass data. `some_method { 100 }` is a perfectly valid block, however, usually behavior is passed with a block to execute the behavior a particular way, something that is not needed with data.

### Using Blocks to Execute Behavior

A block is executed within a method with a call to `yield`, as in yield execution to the block.

```ruby
def a_method
  yield
end

a_method { puts 'executed block' }
#=> executed block
```

`yield` will return the value of the block like any other method execution.

```ruby
def another_method
  value = yield
  puts value
end

another_method { 'hello' } # we also pass in data rather than behavior here
# => hello
```

`yield` can pass arguments to the block, you _yield_ the arguments. These in turn can be used by the block in typical `|param|` fashion.

```ruby
def some_method
  yield 'value one', 'value_two'
end

some_method { |a, b| puts [a, b].inspect }
#=> ["value one", "value_two"]
some_method { |a| puts [a].inspect }
#=> ["value one"]
some_method { |a, b, c| puts [a, b, c].inspect }
#=> ["value one", "value_two", nil]
```

As you can see, not all the arguments in the block need to be used. Ones that don't exist will get set to `nil`.

Having gotten a bit of a grasp of blocks, we can recall that blocks are Procs, or at least that is what the [[#Procs, blocks and lambdas|diagram]] told us.

## Blocks and Procs

Lets start our exploration of Procs by exploring exactly how blocks and Procs are related and then moving to define what Procs actually are.

I have already stated that **blocks are Procs** but lets prove it. We have seen how blocks can get passed in to methods and then called with `yield`, however, there is an alternative way of calling that same block with the method `:call`.

```ruby
def some_method(&some_block)
  yield
end
some_method { puts 'executed_block' }
# => 'executed_block'

def some_method(&some_block)
  some_block.call
end
some_method { puts 'executed_block' }
# => 'executed_block'
```

Those two ways of calling the block are functionally identical except for one difference, the block has now been directly assigned to a variable and is accessible as a Proc. We can check that it is now a Proc by calling `some_block.class` which will return `Proc`. So what just happened?

### Procs, Blocks and the Leading &

When a method accepts the argument `&some_argument` as in `def method(&some_argument)` or just `def method(&)` for that matter, it means the method can receive a block and store that block in a variable. [[2022-09-19#*Block Parameter* - only a single block parameter can be defined and ***must*** be in the last position|I wrote in more detail about block parameters here.]]

The basics of what happens here is simply `&` converts a block to a proc and vice-versa. Lets make sure that is what is happening.

First lets create a `Proc` and a function that accepts a `Proc`.

```ruby
def i_take_a_proc(some_proc)
  puts some_proc.class
  some_proc.call
end
some_proc = Proc.new { puts 'proc executed' }

i_take_a_proc(some_proc)
#=> Proc
#=> proc executed
```

We can see that this function does in fact take a Proc and execute it. What happens if we try and pass the function a block?

```ruby
i_take_a_proc { puts 'i am a block '}
#=> ArgumentError: wrong number of arguments
```

The block was not converted to something usable in the function, but we have already seen how that can be done.

```ruby
def i_take_a_block(&some_block)
  puts some_block.class
  some_block.call
end

i_take_a_block { puts 'block executed' }
#=> Proc
#=> block executed
```

We can also see that just like before I can't just pass in a Proc and make it work like a block.

```ruby
i_take_a_block(some_proc)
#=> ArgumentError: wrong number of arguments
```

But I can take that `Proc` use a leading `&` to convert it to a block and then pass that in.

```ruby
i_take_a_block(&some_proc)
#=> Proc
#=> proc executed
```

Cool. So at this point we have established that blocks and procs can be converted to one another with `&` but then how are block procs?

### Blocks Are Procs?

Blocks are procs simply because blocks cannot exist on their own while procs can. If we type `variable = { 'a block' }` we get a `SyntaxError`. That statement makes no sense on its own, but sometimes we need to be able to package up that behavior and store it or pass it around. Procs enable us to pass behavior around.

**Blocks are unpacked Proc objects that cannot exist on their own.** They are essentially raw behavior.

Which now brings us to our next topic, what exactly are Procs?

## Proc Objects

Lets immediately state that a `Proc` is a specific ruby class (unlike a block which does not have a class). The [official documentation for the class](https://ruby-doc.org/core-3.1.2/Proc.html) describes a `Proc` as:

> A `Proc` object is an encapsulation of a block of code, which can be stored in a local variable, passed to a method or another [`Proc`](https://ruby-doc.org/core-3.1.2/Proc.html), and can be called.

That can be broken down into four parts:

1. encapsulation of a block of code
2. can stored in a local variable
3. can be passed to a method or another Proc
4. can be called

Lets quickly explore and demonstrate all those behaviors in a Proc. I won't be going over these too closely since I have already demonstrated many of these behaviors.

### Procs Encapsulating Code

We have already seen this in action but the basics of it is as follows. Imagine we have some behavior say a log statement that tells us we are going to try to save a file `puts 'saving file'`. This behavior can be captured in a Proc object `Proc.new { puts 'saving file' }`. That behavior is now encapsulated, meaning it is separated from the code around it.

### Procs Stored in Local Variables

Having created the Proc object that encapsulates the `puts 'saving file'` behavior we can now store that in a local variable.

```ruby
some_local_variable = Proc.new { puts 'saving file' }
```

### Procs Can Be Passed Around

Just like any other variable we can pass this variable to other methods, or if we wish, to other procs.

```ruby
def some_method(arg)
  puts arg.inspect
end
some_proc = Proc.new { 5 }

some_method(some_proc)
# or we could pass that proc to another proc
other_proc = Proc.new { some_proc }
other_proc.inspect #=> #<Proc:...f58>
other_proc.call.inspect #=> #<Proc:...b70>
```

### Procs Can Be Called

Procs are encapsulations of behavior in a object, so there must be some way to use that behavior after you have captured it, thus, `some_proc.call`.

```ruby
basic_proc = Proc.new { puts 'executes proc'}
basic_proc.call
#=> executes proc
```

The call method simply executes whatever behavior was stored in the proc and passes in arguments if needed.

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**A note on closures**\\
> Closures in ruby are simply a fancy way to describe the behavior of a proc or a block of code dragging its context along with it. What is meant by context? It means that the proc will bring not only behavior but also local variables.
> 
> ```ruby
> times_called = 0
> proc = Proc.new { puts times_called; times_called += 1 }
> proc.call #=> 0
> proc.call #=> 1
> proc.call #=> 2
> #...
> ```
> 
> This behavior brings with it some pitfalls.
> 
> ```ruby
> # say I declare a massive array 
> arr = Array.new(100000)
> # I do stuff with the array but then I return a proc
> return Proc.new { puts 'hello' }
> ```
> 
> The context of the array will be pulled into the block, meaning that massive array object will remain in memory for much longer than it needs to. There is no prefect answer besides simply paying attention and `arr = nil` deallocating the array.

That brings us to our final topic, what are lambdas and how do they relate to procs?

## Lambdas

Let start our exploration of lambdas by comparing them to what we already know, procs. Simply put, lambdas are procs with restrictions. Unlike blocks they can be actually be declared but lambdas fundamentally are procs.

```ruby
a_lambda = lambda { puts 'executed lambda' }
a_lambda.call
#=> executed lambda
a_lambda.inspect #=> #<Proc:0x0...(lambda)>
a_lambda.class #=> Proc
```

But what exactly makes them different from procs? Two main aspects: argument handling and return semantics.

### Argument Handling

#### Argument Matching

Unlike procs lambdas will throw an error unless they get exactly the amount of arguments they are expecting to get. [We have already seen this behavior in blocks but lets show it once more.](#Using Blocks to Execute Behavior)

```ruby
def some_method(a_proc)
  a_proc.call 'value one', 'value_two'
end

some_method Proc.new { |a, b| puts [a, b].inspect }
#=> ["value one", "value_two"]
some_method Proc.new { |a| puts [a].inspect }
#=> ["value one"]
some_method Proc.new { |a, b, c| puts [a, b, c].inspect }
#=> ["value one", "value_two", nil]
```

However, a lambda will not accept those same arguments.

```ruby
some_method lambda { |a, b| puts [a, b].inspect }
#=> ["value one", "value_two"]
some_method lambda { |a| puts [a].inspect }
#=> ArgumentError: wrong number of arguments (given 2, expected 1)
some_method lambda { |a, b, c| puts [a, b, c].inspect }
#=> ArgumentError: wrong number of arguments (given 2, expected 3)
```

#### Array Deconstruction

A proc also has built in array deconstruction.

```ruby
def some_method(a_proc)
  a_proc.call [1, 2]
end

some_method Proc.new { |a| a.inspect } #=> [1, 2]
some_method Proc.new { |a, b| puts a; puts b } #=> 1, 2
```

A lambda cannot do the same.

```ruby
some_method lambda { |a| a.inspect } #=> [1, 2]
some_method lambda { |a, b| puts a; puts b } #=> ArgumentError: given 1 expected 2
```

A lambda is closer to a regular method with positional arguments, it must receive the expected amount of arguments. The other difference in the two is how calls to `return` are handled.

### Return Semantics

The basic difference is in a lambda a call to `return` exits the lambda and returns the final value of the lambda to whatever context called the lambda.

```ruby
def test_method
  lambda { return :exited }.call
  puts 'reached past lambda'
end
test_method #=> reached past lambda

# if we want the lambda return can be stored in a variable
def test_method
  val = lambda { return :exited }.call
  puts val
end
test_method #=> exited
```

In comparison a proc goes one step further and exits out of the proc **then** does the `return`.

```ruby
def test_method
  proc { 3; return; 4}.call
  # because the return first exists the proc 5 is never reached
  return 5
end
test_method #=> nil
# we get nil because after exiting the return call made is simply return
# this can be changed to another value to get something else
def test_method = proc { 3; return :another_val }.call
test_method #=> :another_val
```

`break` behaves in a similar way. in lambdas it will exit like `return` but without actually returning a value. In regular procs `break` will behave like

Having compared procs and lambdas, we can at this point come up with a better definition of what exactly are they.

### Lambdas: a Better Definition

Having established the differences in lambdas and procs we can finally arrive at a proper definition of lambdas.

Lambdas are simply procs with different return behavior and restrictions on arguments. They can be called in two ways with the keyword `lambda { |arg| puts arg.inspect }` or with the syntactic sugar `-> (arg) { puts arg.inspect }`.

## Procs, Lambdas and Blocks in Summary

Lets once again look back to the diagram from the very start, and summarize what all these ruby terms are.

{% include picture_tag.html src="procs_lambdas_blocks_comparison.png" alt="A Venn Diagram depicting the relationship between procs, blocks and lambda. Procs encompass both blocks and lamdas. Block and lambdas do not overlap eachother." %}

**Procs** are encapsulations of behavior that can be saved to variables, passed to methods and called when needed. **Blocks** are that same behavior but without the encapsulation, they can be called but they cannot be saved in a variable without transforming them. Finally, **lambdas** are procs but with a few restrictions on arguments that can be passed in a and how `return` works.

If you got this far I hope I did a reasonable job of explaining these concepts.
