---
layout: post
title: "Managing the Development of Large Software Systems AKA the Waterfall Paper"
summary: The original "Waterfall Paper" by W. Royce is often misunderstood—he actually critiqued the strict sequential model and suggested iterative refinements. Exploring the paper offers a chance to reflect on evolving software development philosophies.
cover-img: /assets/img/thumbnails/waterfall.jpg
thumbnail-img: /assets/img/thumbnails/waterfall.jpg
share-img: /assets/img/thumbnails/waterfall.jpg
readtime: true
toc: true
tags:
  - waterfall
  - agile
  - software-development
  - history
---

# Managing the Development of Large Software Systems AKA the Waterfall Paper

Typically when people talk about "doing your own research" it's with regards to some vaccine or flat Earth nonsense as a way to shift the burden of proof of themselves. However, there is validity in doing your own research. I don't mean building your own experiments, measuring data, etc. I mean going to the primary sources and reading what they are about.

Fundamentally I am a big believer in agile software development and DevOps practices. But recently I came across [two separate](https://articles.pragdave.me/p/ai-coding-is-based-on-a-faulty-premise) [mentions](https://www.youtube.com/watch?v=ecIWPzGEbFc&t=2972s) of the original paper on which the waterfall methodology was based: "Managing the Development of Large Software Systems" by W. Royce 1970. Interestingly, both references suggested that a few people have read the original paper and most people have misconceptions about what Royce was advocating. Thus, I decided maybe I should "do my own research".

## Is Waterfall misrepresented?

The famous diagram of waterfall does in fact come from Royce's paper:

{% include picture_tag.html src="./waterfall-problematic.png" alt="A diagram showing the steps of waterfall development as a series of seven boxes one leading to the next starting from system requirements and ending with operations" %}

And as Dave Thomas points out in his article, Royce was arguing against this form of waterfall. How did Royce want to fix the issues with the waterfall model? Add more processes.

{% include picture_tag.html src="./waterfall-improved.png" alt="The diagram illustrates an improved waterfall model with 7 additional documentation checkpoints, a extensive program design stage and additional abbreviated cycle of building a prototype system " %}

Interestingly, he does arrive at a few conclusions that mirror those of agile. He suggests a "preliminary program design" to build the system once at a small scale to learn from an throw away. He does understand the value of the shorter iteration but does not quite arrive at making that the standard as opposed to just doing it once.

## Why so much process?

Bob Martin in his talk suggests it was due to concerns over the low average experience level of developers at that time. The only way to ensure the software was bug free was to look over their shoulders. Is this true? I don't know.

I do want to highlight what large shift has happened since the 1970s in terms of trust and autonomy given to developers. The paper is littered with quotes that imply the need for autocratic control by management.

Royce opens by saying "The prime function of management is to sell [the process of creating system and software requirements, program design and testing] to [customers and developers] and then enforce compliance on the part of development personnel." This quote is a stark departure from the modern idea of assuming every person on a project wants the best for it.

He talks about "enforcement of documentation requirements", "enforcement of control", "enforcement of compliance". It's a very different world.

### Blame Seeking

Another quote that I found particularly striking was about dealing with bugs and errors. "In order either to absolve the software or to fix the blame, the software documentation must speak clearly." What is that? "Absolve the software"? "Fix the blame"? Accurately placing the blame for an issue does nothing to fix the actual issue. Software development is complicated and if mistakes are followed by blame finding.

Or better yet replacement ("If documentation is in serious default, my first recommendation is simple. Replace project management."), an entire class of learning opportunities is completely cut off. Everything turns into some form of cover-your-ass development.

### Specialists vs Generalists

Royce seems to advocate for specializing programmers into various roles: designers, tests, programmers, etc. And he believes that by sticking to this specialization each person will perform better in their role "with good documentation [...] specialists will [...] do a better job of testing than the designer." And "[the people who built the software] are relatively disinterested in operations and do not do as effective a job as operations oriented personnel [if given good documentation]".

I find the focus on "good documentation" and documentation in general interesting here. The thesis of this system seems to revolve around workers being replaceable cogs in a machine. Each cog does it's own role. And with sufficient documentation each cog should be freely replaceable with another one. I personally don't subscribe to this, but I imagine there is a lot of manufacturing influence in these beliefs.

Also, imagine all the time wasted on this documentation to ensure replacebility. A person needs to build up all the context around a problem, formulate that, write it down on paper and the next person would need to do same. But instead of relying on having the actual problem to solve they have to understand the solution by reading about it. It's like trying to learn how to ride a bike or juggle by reading about it. Its a worse outcome and more time is spent on it.

## Conclusion

Does this paper make me feel differently about waterfall? No. But is does make we wonder which parts of Agile will we look at in 30 years and laugh about.
