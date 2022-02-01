export class Tree {
  constructor() {
    this.rootNode = new TreeNode(null);
    this.currentNode = this.rootNode;

    this[Symbol.iterator] = function () {
      return this;
    };
  }

  add(value) {
    console.log("adding", value, "to the tree");
    // dont add empty/null
    if (!value) throw "adding a falsy value to the tree.";

    // if value is not an array, make it one.
    if (!Array.isArray(value)) {
      value = [value];
    }

    // filter out any falsy values...
    
    if (value.length == 0) throw "cannot add an empty or falsy array to the tree";
    value.forEach((x) => {
      let child = new TreeNode(x);
      child.setParent(this.currentNode);
      this.currentNode.addChild(child);
    });
    //console.log(this.currentNode.children, this.rootNode.children);
  }

  addLoop(values, numIters){
    if (!values) throw "adding a falsy value to the tree.";
    values = values.filter((x) => x);
    if(values.length == 0){
      return;
    }
    for(let j = 0; j < numIters; j++){
      let currNode = new TreeNode(values[0]);
      let rootNode = currNode;
      for(let i = 1; i < values.length; i++){
        let child = new TreeNode(values[i]);
        child.setParent(currNode);
        currNode.addChild(child);
        currNode = child;
      };
      console.log('looping 1!')
      console.log(rootNode)
      rootNode.setParent(this.currentNode);
      this.currentNode.addChild(rootNode);
    }

  }

  hasNext() {
    return this.currentNode.next().done == false;
  }

  isFirst() {
    return this.currentNode.parent === this.rootNode;
  }

  clear() {
    this.rootNode.clearChildren();
    this.currentNode = this.rootNode;
  }

  // ask the current TreeNode what is the next value...
  next() {
    let tmp = this.currentNode.next();

    if (!tmp.done) {
      this.currentNode = tmp.value;
      this.print();
    }

    return tmp;
  }

  // ask the TreeNode what is your previous value....
  // if you cannot go back, the returned element
  // is undefined!
  previous() {
    let tmp = this.currentNode.previous();
    if (!tmp.done) {
      this.currentNode = tmp.value;
      this.currentNode.clearChildren();
      //this.currentNode.children.forEach((child) => child.clearChildren());
      console.log(" ================ PREV ================ ");
      this.print();
    }
    return tmp;
  }

  // remove the current element
  // (this will remove ALL the children element of the current element)
  prune() {
    this.currentNode.removeFromParent();
    this.previous();
  }

  // you can ONLY pop a node that has no
  // children.
  pop() {
    if (this.currentNode.children.length > 0) return;

    let tmp = this.currentNode;
    this.previous();
    tmp.removeFromParent();
  }
  isEmpty() {
    return this.rootNode.children.length == 0;
  }
  toJSON() {
    function nodeJSON(child) {
      let value = child.value;
      let kidsValue = child.children.map((x) => nodeJSON(x));
      return { value: value, children: kidsValue };
    }

    let obj = nodeJSON(this.rootNode);
    obj.currentNode = this.currentNode.value;
    let json = JSON.stringify(obj);
    return json;
  }

  loadFromVanillaObject(object) {
    // reset the root's children
    if (!this.rootNode.children) throw "children is null?";
    this.rootNode.children.length = 0;

    // we lose "this" reference in the mapping...
    let thisObj = this;

    function addKids(node, kidsArray) {
      if (kidsArray.length == 0) return;
      kidsArray.forEach((kid) => {
        let kidNode = new TreeNode(kid.value);
        if (object.currentNode.value == kidNode.value) {
          thisObj.currentNode = kidNode;
        }
        node.addChild(kidNode);
        addKids(kidNode, kid.children);
      });
    }

    addKids(this.rootNode, object.rootNode.children);
  }
  static fromJSON(json) {
    let object = JSON.parse(json);
    let newTree = new Tree();

    newTree.loadFromVanillaObject(object);
    return newTree;
  }

  print() {
    console.log(" ============ TREE ===========");
    let node = this.rootNode.next();
    while (!node.done) {
      console.log(node.value.value, node.value.value == this.currentNode.value ? " <=== currentNode" : "");
      node = node.value.next();
    }
    console.log(" ============================= ");
  }
}

class TreeNode {
  constructor(value) {
    this.value = value;
    this.parent = null;
    this.children = [];
  }

  setParent(parent) {
    this.parent = parent;
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
  }

  lookForNext(child) {
    // child asked for the next node ...
    // lets find his index....
    let childIndex = this.children.indexOf(child);
    // not sure how the index could not be found...
    // unless misused...
    if (childIndex == -1) {
      return { done: true, value: undefined };
    }

    // get the next index and if
    // it is still a valid index
    if (++childIndex < this.children.length) {
      //return this.children[childIndex];
      return { done: false, value: this.children[childIndex] };
    }
    // child was the last element of the array,
    // so ask our parent for the next element...
    // but if we are the root..  return null...
    if (this.parent == null) {
      return { done: true, value: undefined };
    }
    return this.parent.lookForNext(this);
  }

  next() {
    if (this.children.length > 0) {
      return { done: false, value: this.children[0] };
    }
    if (this.parent == null) return { done: true, value: undefined };
    if (this.parent.value == null) return { done: true };
    let myNext = this.parent.lookForNext(this);
    if (myNext.done) {
      return { done: true, value: undefined };
    }
    return myNext;
  }

  lookForPreviousNode(child) {
    // my child asked my to look for his previous sibling...
    // first get the index of my child
    let childIndex = this.children.indexOf(child);

    // not sure how the index could not be found...
    // unless misused...  Should I throw an exception?
    if (childIndex == -1) {
      return { done: true, value: undefined };
    }

    if (childIndex > 0) {
      let lastChild = this.children[childIndex - 1].getLastChild();
      return { done: false, value: lastChild };
    }

    // Mu first child is calling, return me...
    // unless I am the root, we never return the root.
    if (this.parent == null) {
      return { done: true, value: undefined };
    }

    return { done: false, value: this };
  }

  getLastChild() {
    // I have been asked to by my parent to get the last child
    // if I dont have any children.. return me.
    if (this.children.length > 0) {
      return this.children[this.children.length - 1].getLastChild();
    }
    return this;
  }

  previous() {
    // ask my parent for the previous sibling (or if I am the first, it's my parent)
    if (this.parent) {
      return this.parent.lookForPreviousNode(this);
    }

    // if you are at the root, you wont have a parent
    // and you cannot go back...
    return { done: true, value: undefined };
  }

  iterator() {
    return new Tree(this);
  }

  clearChildren() {
    this.children = [];
    this.currentNode = this.rootNode;
  }

  removeChild(child) {
    let childIndex = this.children.indexOf(child);
    if (childIndex == -1) return;
    this.children.splice(childIndex, 1);
  }
  removeFromParent() {
    this.parent.removeChild(this);
  }
}
