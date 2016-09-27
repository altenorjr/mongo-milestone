# MongoMilestone

*A life-saving little tool to work around the lack of ACID Transactions in MongoDB* 

 * Job scheduler for those who can't afford to stop an operation
 * Don't worry about two-phase commits. I got you covered.
 * Don't worry about those complex operations that need to happen in different order.
 * It will work even if the operation is interrupted in the middle of the process.
 * You won't have much to worry about the curious 17 y.o. intern that is always catching pokémons way too close to the servers.
 * All the information resides in the database. You can restart and crash you app as many times as you want.
 * It doesn't really matter where is the what creates a milestone. The operations will run to completion.
 * Or die trying.
 * But don't worry. As long as your database is reachable we'll store all the information about eventual failures. Even the stack trace is there
 * Works as an operations log for the most important events fo your business: The **Milestones**.


Let's take, for example, a bank transfer. You can't afford to be interrupted We're going go create a robot that will make sure that all your transactions will be *eventually* completed.
````javascript
//Main Application. This must be run once
import { A } from 'my-vanity-and-perfectionism';
import { configure } from 'mongo-milestone';
    
configure('mongodb://localhost:27017/milestone').then(({ register, spawn }) => {
	register({ name: 'debit', fn: A.Function.That.Subtracts.The.First.Account });
    register({ name: 'credit', fn: A.Function.That.Adds.Into.The.Second.Account });
        
	spawn();
});
````   
That's it! That's literally all you have to do to make these two procedures happen in order and guaranteed that they'll run to completions. The *spawn* function takes care of all the heavy lifting, running periodically searching for newly inserted jobs. And yes, you can configure this period, among other things.

Ok, now it's time to send some jobs for the robot to take care of:

````javascript
//You can place this anywhere else in your code, as long as it runs after the database is connected.
import { Milestone, Action };
    
const transfer = new Milestone({ 
	type: 'bank-transfer', 
    action: new Action({ 
    	type: 'debit', 
        next: new Action({ type: 'credit' }) 
	}),
	parameters: { from: 'a', to : 'b', ammount: 1000 }
});
    
transfer.save();
````

And that's it. Instead of trying to perform the operation yourself, hand it over to the robot. If it can't complete the job it'll keep trying until it can, logging all the information about the failure, with a detailed attempt log that even includes the original StackTraces of the code, in case something goes bad.

This is made possible by the two classes we just met, **Milestone** and **Action**, along with an internal class called **Attempt**

## Action

I like to thing about an **Action** as a stored Promise. Because that's what it's meant to be. The internal job of the robot is to convert Actions in Promises and keep track of when the Promise was rejected or resolved.

An **Action** has a type, a related registered function (a.k.a. as *method*), a *next* **Action** array (that can run multiple operations *virtually* in parallel) and an optional *done* **Action**, that will be run after all other **Actions** have completed.

##### Constructor signature

````javascript
{ import { Action } from 'mongo-milestone' }

const action = new Action({
	type, //String. Required
    method = type, //String. Defaults to the type.
    next = [], //Action array. If an Action is passed the constructor converts it to an array of one Action
    done = null //Action to be executed after the *method* and all the actions in *next* are run successfully
});
`````
**DISCLAIMER**: Destructuring assignments are cool. And super useful. More about this decision you can [see here](http://www.2ality.com/2015/01/es6-destructuring.html) [and here](http://exploringjs.com/es6/ch_parameter-handling.html).

##### Instance fields
* _**type**_: 
> String. Taken from the constructor. Used to filter the types of **Actions** later

* _**method**_: 
> String. Taken from the constructor, that defaults it to the type. Name of the registered method to run when this promise is executed. If it's deliberately set to null, the **Action** will end right away and it will begin executing the actions in *next*. This is useful to start a parallel job and you don't want to code an action just for it. NOTICE that when the *method* is null it's required to have at least 2 Actions in the *next* field, otherwise it wouldn't make sense.

* _**next**_: 
> Optional array of **Actions** to be executed after the completion of the current **Action**. Taken from the constructor. 

* _**done**_: 
> Optional **Action** to be run after all **Actions** in *next* are completed. Taken from the constructor.

* _**state**_: 
> Boolean with *false* by default. As soon as the Action is completed it becomes *true*, even before running the *next* **Actions**.

* _**report**_: 
> Array of **Attempts**. See below.

## Milestone

Think of the Milestone as something you totally want to happen. It's composed of a *type*, a *root* Action (triggered as soon as the Milestone begins to run) and it's initial set of parameters

##### Constructor signature

````javascript
{ import { Milestone } from 'mongo-milestone' }

const milestone = new Milestone({ 
	type, //String. Required
	action, //Action. Required
    parameters, //Any
});
`````

##### Instance fields

* _**type**_: 
> String. Taken from the constructor. Used to filter the types of **Milestones** later

* _**action**_: 
> The *root* **Action**. Taken from the constructor

* _**parameters**_: 
> Any value. Or no value at all. Taken from the constructor and passed into all the **Actions** in this **Milestone**

* _**beginDate**_: 
> The date this **Milestone** was run for the first time. Or null if it's never been run.

* _**endDate**_: 
> The date this **Milestone** was completed. Or null if it's not complete yet.

* _**state**_: 
> Boolean with *false* by default. As soon as the Milestone is completed it becomes *true*.

* _**output**_: 
> The compilation of the return of all the **Actions** run in the **Milestone**

* _**report**_: 
> Array of **Named Attempts**. See below.


##### Instance methods

* _**save()**_: 
> Saves the Milestone to the database. Returns a Promise that resolves with the Milestone after saving it. The robot will pick the Milestone up and run it during it's next pass
> ````javascript
> Milestone.prototype.save = () => {
> 		return db.collections('_milestones_').insertOne(this).then(() => (this));
> }
> ````
## Attempts & Named Attempts

Every time the robot tries to run an **Action** we get notified about how it's going. The *report* field stores these notifications in both **Action** and **Milestone**. Each one of thesr notifications which are called **Attempts**.

A **Named Attempt** is just a regular **Attempt** that includes an extra field *name*. It's used only in the **Milestone**'s *report* to keep track of the overall health of the operation in a kind of linear view.


##### Fields

* _**name**_: 
> String. Required on Named Attempts and forbidden on regular Attemps

* _**success**_: 
> Boolean or null. A *null* value indicates that the Attempt was never completed nor explicitally failed. It might still be running, for all we know. A *true* value indicates that this attempt was successful. A *false* value indicates that this attempt failed and will be retried as soon as the robot makes another pass

* _**beginDate**_: 
> Date when this Attempt was initially made. It's never null

* _**endDate**_: 
> ate when this Attempt was completed or failed. It's initially null

* _**input**_: 
> A copy of the input parameters used in this Attempt

* _**output**_: 
> The result of this attempt. if it's successfull you'll find the results here. If it fails, you find a fullly serialized error ready to be inspected. Even the Stack Traces are there


### A word on parameter handling
Every time a we pass parameters like ````{ id: 1 }```` to a **Milestone**, it is passed down to the **Action**'s method in the form of ````{ milestone: { id: 1 } }````. As every **Action** can resolve with an output, this output will be passed in the *parameters* object to the *next* or *done* **Actions** of the current **Action**. This allows nice composability between **Actions** that might need the value from a previous operation in order to be executed.

In the first example, for instance, the *root* **Action** (*debit*) receives ````{ milestone: { from: 'a', to: 'b', amount: 1000 } }````. 
Let's say that the *debit* **Action** succeded and returned with ````{ previousBalance: 1000, updatedBalance: 9000 }````. Like this, the *method* configured in the *credit* **Action** will receive the following object: 

````javascript
{ 
	milestone: { from: 'a', to: 'b', amount: 1000 },
	debit: { previousValance: 10000, updatedBalance: 9000 }
}
````

You could even use parameter destructuring to choose only what you want in your method, like so

````javascript
const credit = ({ milestone }) => { console.log(milestone) };
````

This way, every future operation has knowledge of the output of all previous operations, in a way it can benefit from this information and conditionally change the operation behaviour. Just like you'd do normally, but in a safer way. This obviously doesn't apply to parallel operations. Just because it doesn't make any sense that parallels operations need information from one another. If they do, they should be sequential

### Abandoned Actions
Every time the robot runs an **Action** it logs the *beginDate* in an **Attempt**. If something happens (a power outage, for example) this **Action** will never be resolved and the robot will never know that it's necessary to try again. So, after some time (30 minutes, by default), the robot disregards the pending **Attempt** and starts again. That's what's called an "abandoned **Attempt**". You must set this time very carefull (*we'll see how in 30 seconds*) or you risk run the same operation twice. That's preciselly why you should always make: 

Yeah, you guessed.

### Idempotent Functions
Idempotent operations are operations that can be executed basically forever without having a different output or side effects. This library is optimized for use with idempotent functions. And I think it's fair to let you know this beforehand. But seriously, you should make your functions idempotent every time you can. It's free.


# API

### configure

It's the only function export of the library. It's required to call it at least once. After the database is connected it resolves with more methods that you could use.

````javascript
const configure = (mongoConnectionString, retryTimespan = 30, jobsCollectionName = "_milestones_") => {
	return new Promise((resolve) => resolve({ run, spawn, register, unregister, bulkRegister }));
};

//usage

configure('mongodb://localhost:27017/test', 15).then(({ bulkRegister, spawn }) => {});
````

##### Parameters
* _**mongoConnectionString**_: The connection string to the database
* _**retryTimespan**_: Time (in minutes) to wait before considering an Action as abandoned and trying it again. Defaults to 30 minutes
* _**jobsCollectionName**_: The name of the collection used by the library to store the operations. Defaults to '\_milestones_'

##### Methods returned in the resolved Promise
* _**run**_
> ````javascript
> const run = () => {
> 		return Promise((resolve) => resolve({ found, resolved, rejected, elapsed }));
> }
> ````
> 
> Runs the robot _**ONCE**_ over all pending **Milestones** . Used internally to run each pass of the robot. Returns a Promise which is eventually resolved with the **Milestones** found, which ones were resolved, which ones were rejected and the time taken for the robot to complete the run, along with the time taken by each individual milestone. 
>````javascript
>{ 
>	 	found: [{ _id, type, parameters }], 
>    	resolved: [{ milestone: { _id, type, parameters }, output: {}, elapsed: `0:0"2'987ms` }], 
>    	rejected: [{ milestone: { _id, type, parameters }, error: new Error(), elapsed: `0:0"0'221ms` }], 
>    	elapsed: `0:23"32'342ms`
>}
>
>//usage
>run().then(({ found, resolved, rejected, elapsed }) => {});
>````

* _**spawn**_: 
> ````javascript
> const spawn = () => {
> 		return Promise((resolve) => { 
> 			run()
> 				.then((result) => resolve(result))
> 				.then(() => spawn());
>		});
> }
> ````
> Runs the robot over all pending **Milestones**. When it's done, it starts over. And keeps doing it until you stop it or something really bad happens. Has tha same signature and overall behaviour of _**run**_, but it's Promise ~~(for obvious reasons)~~ just returns for the first run, and as it just relays the output of _**run**_ to the callee before starting over

* _**register**_: 
> ````javascript
>const register = ({ name, fn }) => {
>		registry.add(name, fn);
>}
> ````
> Registers a function. When the robot tries to execute an **Action** it uses the *method* property, that is in turn defaulted from the *type* property. If the function isn't the method will throw an exception

* _**unregister**_: 
> ````javascript
> const unregister = (name) => {
>		registry[name ? 'remove' : 'clear'](name);
> };
> ````
> Unregisters a function by its name. If ````name === false```` it **unregisters all registered functions**

* _**bulkRegister**_: 
> ````javascript
> const bulkRegister = (obj) => {
>		for (var key in obj) {
> 			register(key, obj[key'])
> 		}
> }; 	
> ````
> Alternative syntax to clean up function registration. The ```obj``` passed looks like this
> ````javascript
> {
> 		'method-name-1': (parameters) => 1,
> 		'method-name-2': (parameters) => 2,
> 		'method-name-3': (parameters) => 3
> }
> ````