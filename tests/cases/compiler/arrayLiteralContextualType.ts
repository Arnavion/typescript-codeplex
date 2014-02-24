interface IAnimal {
    name: string;
}

class Giraffe {
    name = "Giraffe";
    neckLength = "3m";
}

class Elephant {
    name = "Elephant";
    trunkDiameter = "20cm";
}

function foo(animals: IAnimal[]) { }
function bar(animals: { [n: number]: IAnimal }) { }

foo([
    new Giraffe(),
    new Elephant()
]); // Legal because of the contextual type IAnimal provided by the parameter
bar([
    new Giraffe(),
    new Elephant()
]); // Legal because of the contextual type IAnimal provided by the parameter

var arr = [new Giraffe(), new Elephant()];
foo(arr); // Error because of no contextual type
bar(arr); // Error because of no contextual type