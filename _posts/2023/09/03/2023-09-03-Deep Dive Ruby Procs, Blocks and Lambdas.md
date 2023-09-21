---
layout: post
title: "Deep Dive: Ruby Procs, Blocks and Lambdas"
readtime: true
toc: true
published: false
tags:
  - ruby
  - blocks
  - procs
  - lambdas
summary: This post delves into Ruby's Procs, Blocks, and Lambdas. It clarifies their differences and usage. Blocks encapsulate behavior, allowing dynamic code execution. Procs encapsulate blocks and can be stored, passed, and executed. Lambdas, a type of Proc, have stricter argument handling and return semantics. This post aims to demystify these Ruby concepts.
---

# Deep Dive: Ruby Procs, Blocks, and Lambdas

I am sure that a Ruby developer is familiar with blocks of code. That is behavior being encapsulated in a `do end` or `{ }`. But have you run into `&` as a function parameter, calls to `yield` within a function, or confusing arrow functions like `-> () { … }`? These are all Procs, Blocks, or Lambdas. In this post, I hope to clarify the differences between them and provide you with the tools to use them in your future endeavors.

Let's start with the most basic statement of how procs, blocks, and lambdas are related to one another. The Venn diagram below provides a quick illustration. In essence, the `Proc` class encompasses both blocks and lambdas; however, both lambdas and blocks are different from each other.

{% include picture_tag.html src="procs_lambdas_blocks_comparison.png" alt="A Venn Diagram depicting the relationship between procs, blocks, and lambdas. Procs encompass both blocks and lambdas. Blocks and lambdas do not overlap with each other." %}

Defining these concepts alone doesn't really do much. So let's explore them in a more code-focused manner. I will start with blocks because I find them to be the easiest to explain.

## Blocks

**A block is a way to pass behavior** (as opposed to data).

What exactly does that mean? Let's imagine a scenario. You are working on a tool that transforms some data you pass from strings to JSON. It is working fine and dandy, but you keep finding different transformations that you wish to perform. You keep having to tell the program which of the existing behaviors to run, for example, transforming from XML with `run_program(data, :from_xml)`. Wouldn't it be so much nicer if you could pass the transformation behavior in directly?

That is exactly what blocks are for! Basically, instead of giving a method direct values `method(some_value)`, you give the method behavior like this: `method { #some behavior }`. One might say you are passing a _block_ of behavior.

Blocks come in two forms:

```ruby
some_method { puts 'behavior being passed to the method' }
# or
some_method do
    puts 'behavior but in a do/end block'
end
```

I should note that although the goal of blocks is to pass behavior, that does not mean they cannot pass data. `some_method { 100 }` is a perfectly valid block. Usually, behavior is passed with a block to execute the behavior in a particular way, something that is not needed with data.

### Using Blocks to Execute Behavior

A block is executed within a method with a call to `yield`, as in yielding execution to the block.

```ruby
def a_method
  yield
end

a_method { puts 'executed block' }
#=> executed block
```

`yield` will return the value of the block, just like any other method execution.

```ruby
def another_method
  value = yield
  puts value
end

another_method { 'hello' }
# => hello
```

`yield` can pass arguments to the block; you _yield_ the arguments. These, in turn, can be used by the block in a typical `|param|` fashion.

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

Having gotten a bit of a grasp of blocks, we can recall that blocks are Procs.

## Blocks and Procs

Let's start our exploration of Procs by exploring exactly how blocks and Procs are related and then moving on to defining what Procs actually are.

I have already stated that **blocks are Procs**, but let's prove it. We have seen how blocks can be passed into methods and then called with `yield`. However, there is an alternative way of calling that same block with the method `:call`.

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

Those two ways of calling the block are functionally identical except for one difference: the block has now been directly assigned to a variable and is accessible as a Proc. We can check that it is now a Proc by calling `some_block.class`, which will return `Proc`. So what just happened?

### Procs, Blocks, and the Leading &

When a method accepts the argument `&some_argument`, as in `def method(&some_argument)` or just `def method(&)` for that matter, it means the method can receive a block and store that block in a variable.

Similar to the conversion from a value to a pointer, `&` converts a block to a proc and vice-versa.

Let's write some code to prove to ourselves we understand what is going on. First, let's create a `Proc` and a function that accepts a `Proc`.

```ruby
def i_take_a_proc(some_proc)
  puts some_proc.class
  some_proc.call
end
some_proc = Proc.new { puts 'proc executed' }

i_take_a_proc(some_proc)
# => Proc
# => proc executed
```

We can see that this function takes a `Proc` and executes it. What happens if we try to pass the function a block?

```ruby
i_take_a_proc { puts 'I am a block '}
# => ArgumentError: wrong number of arguments
```

The block was not converted to something usable in the function, but we have already seen how that can be done.

```ruby
def i_take_a_block(&some_block)
  puts some_block.class
  some_block.call
end

i_take_a_block { puts 'block executed' }
# => Proc
# => block executed
```

We can also see that just like before, I can't just pass in a Proc and make it work like a block.

```ruby
i_take_a_block(some_proc)
# => ArgumentError: wrong number of arguments
```

But I can take that `Proc`, use a leading `&` to convert it to a block, and then pass that in.

```ruby
i_take_a_block(&some_proc)
# => Proc
# => proc executed
```

Cool. So at this point, we have established that blocks and procs can be converted to one another with `&`. But then, how are block procs?

### Blocks Are Procs?

Blocks are procs simply because blocks cannot exist on their own, while procs can. If we type `variable = { 'a block' }`, we get a `SyntaxError`. That statement makes no sense on its own,

but sometimes we need to be able to package up that behavior and store it or pass it around. Procs enable us to pass behavior around.

**Blocks are unpacked Proc objects that cannot exist on their own.** They are essentially raw behavior.

Which now brings us to our next topic: what exactly are Procs?

## Proc Objects

Let's immediately state that a `Proc` is a specific Ruby class (unlike a block, which does not have a class). The [official documentation for the class](https://ruby-doc.org/core-3.1.2/Proc.html) describes a `Proc` as:

> A `Proc` object is an encapsulation of a block of code, which can be stored in a local variable, passed to a method or another [`Proc`](https://ruby-doc.org/core-3.1.2/Proc.html), and can be called.

That can be broken down into four parts:

1. Encapsulation of a block of code.
2. Can be stored in a local variable.
3. Can be passed to a method or another [`Proc`](https://ruby-doc.org/core-3.1.2/Proc.html).
4. Can be called.

Let's quickly explore and demonstrate all those behaviors in a Proc. I won't be going over these too closely since I have already demonstrated many of these behaviors.

### Procs Encapsulating Code

We have already seen this in action, but the basics of it are as follows. Imagine we have some behavior, say, a log statement that tells us we are going to try to save a file: `puts 'saving file'`. This behavior can be captured in a Proc object: `Proc.new { puts 'saving file' }`. That behavior is now encapsulated, meaning it is separated from the code around it.

### Procs Stored in Local Variables

Having created the Proc object that encapsulates the `puts 'saving file'` behavior, we can now store that in a local variable.

```ruby
some_local_variable = Proc.new { puts 'saving file' }
```

### Procs Can Be Passed Around

Just like any other variable, we can pass this variable to other methods, or if we wish, to other procs.

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

Procs are encapsulations of behavior in an object, so there must be some way to use that behavior after you have captured it, thus, `some_proc.call`.

```ruby
basic_proc = Proc.new { puts 'executes proc'}
basic_proc.call
#=> executes proc
```

The call method simply executes whatever behavior was stored in the proc and passes in arguments if needed.

{: .box-note .ignore-blockquote }

<!-- prettier-ignore -->
>**A note on closures**\\
> Closures in Ruby are simply a fancy way to describe the behavior of a proc or a block of code dragging its context along with it. What is meant by context? It means that the proc will bring not only behavior but also local variables.
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

Let's start by defining what a Lambda is so that we have a basis for our exploration. In Ruby, a lambda is a type of anonymous function or closure. It's a way to define a block of code that can be stored in a variable and then executed later, just like a regular method or function.

Here's a basic syntax for defining a lambda in Ruby:

```ruby
my_lambda = lambda { |arg1, arg2| code_to_execute }
# You can also use the -> syntax for a more concise lambda definition
my_lambda = ->(arg1, arg2) { code_to_execute }
```

Lambdas are fundamentally Procs.

```ruby
a_lambda = lambda { puts 'executed lambda' }
a_lambda.call
#=> executed lambda
a_lambda.inspect #=> #<Proc:0x0...(lambda)>
a_lambda.class #=> Proc
```

But there are differences in behavior. There are two main aspects: argument handling and return semantics.

### Argument Handling

#### Argument Matching

Unlike procs, lambdas will throw an error unless they get exactly the amount of arguments they are expecting to get. [We have already seen this behavior in blocks, but let's show it once more.](#Using Blocks to Execute Behavior)

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

A proc also has built-in array deconstruction.

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

A lambda is closer to a regular method with positional arguments; it must receive the expected amount of arguments. The other difference in the two is how calls to `return` are handled.

### Return Semantics

In a lambda, a call to `return

` exits the lambda and returns the final value of the lambda to whatever context called the lambda.

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

In comparison, a proc goes one step further and exits out of the proc **then** does the `return`.

```ruby
def test_method
  proc { 3; return; 4}.call
  # because the return first exists the proc 5 is never reached
  return 5
end
test_method #=> nil
# we get nil because after exiting, the return call made is simply return
# this can be changed to another value to get something else
def test_method = proc { 3; return :another_val }.call
test_method #=> :another_val
```

## Procs, Lambdas, and Blocks in Summary

In most cases, you are going to either be using Lambdas to mimic the behavior of anonymous functions and closures or using blocks since they are the most familiar way of passing behavior.

Let's once again look back to the diagram from the very start and summarize what all these Ruby terms are.

{% include picture_tag.html src="procs_lambdas_blocks_comparison.png" alt="A Venn Diagram depicting the relationship between procs, blocks, and lambdas. Procs encompass both blocks and lambdas. Blocks and lambdas do not overlap with each other." %}

**Procs** are encapsulations of behavior that can be saved to variables, passed to methods, and called when needed. **Blocks** are that same behavior but without the encapsulation; they can be called but they cannot be saved in a variable without transforming them. Finally, **lambdas** are procs but with a few restrictions on arguments that can be passed in and how `return` works.

If you got this far, I hope I did a reasonable job of explaining these concepts.
