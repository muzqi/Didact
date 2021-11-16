function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child => (
        typeof child === 'object'
          ? child
          : createTextElement(child)
      )),
    },
  }
}

function createDom(fiber) {
  const dom = fiber.type === 'TEXT_ELEMENT'
    ? document.createTextNode('')
    : document.createElement(fiber.type);

  const isProperty = key => key !== 'children';

  // 配置 dom attributes
  Object.keys(element.props)
    .filter(isProperty)
    .map(name => {
      dom[name] = fiber.props[name];
    });

  return dom;
}

function commitRoot() {
  // 提交 wipRoot，并清空 wipRoot
  console.log(wipRoot);
  commitWork(wipRoot.child);
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }
  const domParent = fiber.parent.dom;
  domParent.appendChild(fiber.dom);
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
  }

  nextUnitOfWork = wipRoot;
}

let nextUnitOfWork = null;/* */// 供下一个工作单元使用的 Fiber 节点(performUnitOfWork 调用)
let wipRoot = null;/*        */// wip = work in progress 目前正在使用的 Fiber 节点，全量

/**
 * 当浏览器有空闲时间时，会执行该方法
 */
function workLoop(deedline) {
  let shouldYield = false;

  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deedline.timeRemaining() < 1;
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
  // 1 如果传入 fiber.dom 为空，则创建并挂载
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // 2 遍历 fiber 节点下的所有 children，并创建新的 fiber 节点
  const elements = fiber.props.children;
  let index = 0;
  let prevSibling = null;

  while (index < elements.length) {
    const element = elements[index];

    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,/*       */// 每个新 fiber 节点的 parent，都指向当前 unit of work 的 fiber
      dom: null,
    }

    // 2.1 下标为 0 的元素直接赋值给 unit of work 中的 fiber.child
    //     下标非 0 的元素，丢给 fiber.child.sibling，并逐层嵌套
    //
    //     特别注意这里的 `prevSibling.sibling = newFiber` 和 `prevSibling = newFiber`
    //     当 index === 0 时，会执行 `prevSibling = newFiber`，因为 newFiber 指针指向 fiber，所以这里实际将 prevSibling 的指针指向了 fiber；
    //     当 index === 1 时，会执行 `prevSibling.sibling = newFiber`，此时的 prevSibling 其实指向的上一个 fiber，所以这里是对上一个 fiber.sibling 直接赋值，值就是当前的 fiber；
    //     `prevSibling.sibling = newFiber` 执行完毕后，再执行 `prevSibling = newFiber`，以此往复。
    if (index === 0) {
      fiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;

    index++;
  }

  // 3.1 当以上循环完成后，就将 fiber.child 返回，workLoop 方法会执行 `nextUnitOfWork = performUnitOfWork(nextUnitOfWork)`，
  //     这就进入了下一轮循环。
  if (fiber.child) {
    return fiber.child;
  }

  // 3.2 如果已经走到了末级节点，即 fiber.child 为空，则从当前 fiber 节点向上查找(nextFiber = nextFiber.parent)，
  //     每向上一级，查询该级节点是否有 sibling 节点，有则 return，进入该节点遍历，没有则一直向上，直到 nextFiber.parent 为 null，结束遍历
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }

    nextFiber = nextFiber.parent;
  }
}

const Didact = { createElement, render };
