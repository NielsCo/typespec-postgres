export class DirectedGraph<T> {
    private adjacencyList: Map<T, Set<T>>;

    constructor() {
        this.adjacencyList = new Map();
    }

    addNode(node: T): void {
        if (!this.adjacencyList.has(node)) {
            this.adjacencyList.set(node, new Set());
        }
    }

    addEdge(from: T, to: T): void {
        if (from === to) {
            return; // Do not add an edge from a node to itself. This is okay because self-referencing is allowed in PostgreSQL.
        }
        this.addNode(from);
        this.addNode(to);
        this.adjacencyList.get(from)!.add(to);
    }

    nodes(): T[] {
        return Array.from(this.adjacencyList.keys());
    }

    outNeighbors(node: T): T[] {
        return Array.from(this.adjacencyList.get(node)!.values());
    }

    getEdges(): Array<[T, T]> {
        const edges: Array<[T, T]> = [];
        for (const [from, outSet] of this.adjacencyList.entries()) {
            for (const to of outSet.values()) {
                edges.push([from, to]);
            }
        }
        return edges;
    }

    referenceHierarchySort(): T[] {
        const visited = new Set<T>();
        const result: T[] = [];

        const visit = (node: T): void => {
            if (visited.has(node)) return;
            visited.add(node);

            // Visit all nodes that the current node has outgoing edges to
            const outNeighbors = this.outNeighbors(node);
            for (const neighbor of outNeighbors) {
                visit(neighbor);
            }

            // Add the node to the result list after visiting all its neighbors
            result.push(node);
        };

        // Process all nodes
        for (const node of this.nodes()) {
            visit(node);
        }

        return result;
    }

    getNodesInCycles(): T[] {
        const visited = new Set<T>();
        const stack = new Set<T>();
        const cycleNodes = new Set<T>();

        function visit(node: T, graph: DirectedGraph<T>): boolean {
            if (stack.has(node)) return true;
            if (visited.has(node)) return false;

            visited.add(node);
            stack.add(node);

            const neighbors = graph.outNeighbors(node);
            for (const neighbor of neighbors) {
                if (visit(neighbor, graph)) {
                    cycleNodes.add(node);
                    return true;
                }
            }

            stack.delete(node);
            return false;
        }

        for (const node of this.nodes()) {
            visit(node, this);
        }

        return Array.from(cycleNodes);
    }

    removeNode(node: T): void {
        if (!this.adjacencyList.has(node)) {
            /* c8 ignore next 2 */ 
            return;
        }

        // Remove all outgoing edges from the node
        this.adjacencyList.delete(node);

        // Remove all incoming edges to the node
        for (const [, outSet] of this.adjacencyList.entries()) {
            outSet.delete(node);
        }
    }
}