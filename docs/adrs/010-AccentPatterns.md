Implement AccentPattern in the domain layer.

Create:

domain/valueObjects/AccentPattern.ts

Requirements:

AccentPattern should:

* Represent the accent for each beat.
* Store a boolean array.
* Validate that the pattern length equals the number of beats in the measure.
* Expose:

isAccent(beatIndex)

Examples:

4/4
[true,false,false,false]

3/4
[true,false,false]

7/8
[true,false,true,false,true,false,false]

Update RuntimeScheduler so Tick.isAccent comes from AccentPattern instead of assuming Beat 1 is always accented.

Keep all musical rules inside the domain.

React components should never calculate accents.
